import {
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { BusSuivi, type EvenementSuivi } from './bus-suivi';
import { SuiviService } from './suivi.service';
import { cleChangement } from './types';

// Chaque évaluation suivie a sa « salle » : seuls ceux qui l'ont rejointe reçoivent ses messages.
const PREFIXE_SALLE = 'evaluation:';
const salleDe = (evaluationId: string) => `${PREFIXE_SALLE}${evaluationId}`;

// LA PASSERELLE DU SUIVI EN DIRECT (Socket.IO). Adresse : « /suivi ».
//
// L'enseignant se connecte avec son jeton et son établissement, puis « rejoint » une de ses
// évaluations. Il reçoit ensuite, sans rien demander :
//  - « etudiant:maj »    : la ligne d'un étudiant qui vient de changer ;
//  - « incident »        : une nouvelle ligne du journal (c'est l'alerte en temps réel) ;
//  - « evaluation:maj »  : le nouvel état de l'évaluation (terminée...).
@WebSocketGateway({
  namespace: '/suivi',
  // Même adresse autorisée que dans main.ts (à rendre configurable à la mise en ligne).
  cors: { origin: 'http://localhost:5173' },
})
export class SuiviGateway
  implements OnGatewayInit, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SuiviGateway.name);

  @WebSocketServer()
  serveur!: Namespace;

  private arreterEcoute: (() => void) | null = null;
  private verificationEnCours = false;

  // Ce que l'enseignant connaît déjà : pour chaque évaluation, la « clé de changement » de
  // chaque étudiant. Sert à n'envoyer que ce qui a vraiment changé.
  private readonly clesConnues = new Map<string, Map<string, string>>();
  private readonly statutsConnus = new Map<string, string>();

  constructor(
    private readonly auth: AuthService,
    private readonly suivi: SuiviService,
    private readonly bus: BusSuivi,
  ) {}

  // À l'ouverture de la passerelle : toute connexion doit prouver qui elle est AVANT d'être
  // acceptée (jeton valide + membre actif de l'établissement avec le rôle « enseignant »).
  afterInit(serveur: Namespace): void {
    serveur.use((socket, suite) => {
      this.authentifier(socket)
        .then(() => suite())
        .catch(() => suite(new Error('Accès refusé.')));
    });
  }

  // On écoute le « bus » : ce que le passage et le suivi annoncent est transmis à l'enseignant.
  onModuleInit(): void {
    this.arreterEcoute = this.bus.ecouter((evenement) => {
      void this.traiter(evenement);
    });
  }

  onModuleDestroy(): void {
    this.arreterEcoute?.();
  }

  // L'enseignant demande à suivre une évaluation. Le serveur répond (accusé de réception)
  // par l'état complet des étudiants, ou par un refus.
  @SubscribeMessage('rejoindre')
  async rejoindre(
    @ConnectedSocket() socket: Socket,
    @MessageBody() corps: { evaluationId?: unknown },
  ) {
    const membre = socket.data.membre as Membre | undefined;
    const evaluationId =
      typeof corps?.evaluationId === 'string' ? corps.evaluationId : '';
    if (!membre || !isUUID(evaluationId)) {
      return { ok: false, message: 'Demande invalide.' };
    }

    try {
      // Cette méthode vérifie que l'évaluation appartient bien à CET enseignant.
      const etat = await this.suivi.etat(membre, evaluationId);
      await socket.join(salleDe(evaluationId));

      if (!this.clesConnues.has(evaluationId)) {
        this.clesConnues.set(
          evaluationId,
          new Map(
            etat.etudiants.map((e) => [e.participationId, cleChangement(e)]),
          ),
        );
        this.statutsConnus.set(evaluationId, etat.evaluation.statut);
      }
      return { ok: true, ...etat };
    } catch (erreur) {
      return {
        ok: false,
        message:
          erreur instanceof Error ? erreur.message : 'Impossible de suivre.',
      };
    }
  }

  // L'enseignant arrête de suivre une évaluation.
  @SubscribeMessage('quitter')
  async quitter(
    @ConnectedSocket() socket: Socket,
    @MessageBody() corps: { evaluationId?: unknown },
  ) {
    if (typeof corps?.evaluationId === 'string') {
      await socket.leave(salleDe(corps.evaluationId));
    }
    return { ok: true };
  }

  // Toutes les 4 secondes : on regarde, pour chaque évaluation suivie, ce qui a changé
  // (un étudiant « coupé », une nouvelle question...) et on ne prévient que si besoin.
  @Interval(4_000)
  async verifierChangements(): Promise<void> {
    if (this.verificationEnCours) return;
    this.verificationEnCours = true;
    try {
      const suivies = this.evaluationsSuivies();
      for (const evaluationId of suivies) {
        await this.diffuserEvaluation(evaluationId);
      }
      // On oublie ce qu'on savait des évaluations que plus personne ne suit.
      for (const evaluationId of [...this.clesConnues.keys()]) {
        if (!suivies.includes(evaluationId)) {
          this.clesConnues.delete(evaluationId);
          this.statutsConnus.delete(evaluationId);
        }
      }
    } catch (erreur) {
      this.logger.error(
        'Échec de la vérification du suivi',
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
    } finally {
      this.verificationEnCours = false;
    }
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Vérifie le jeton et l'établissement envoyés à la connexion.
  private async authentifier(socket: Socket): Promise<void> {
    const infos = socket.handshake.auth as {
      jeton?: unknown;
      etablissementId?: unknown;
    };
    const jeton = typeof infos.jeton === 'string' ? infos.jeton : '';
    const etablissementId =
      typeof infos.etablissementId === 'string' ? infos.etablissementId : '';
    if (jeton === '' || !isUUID(etablissementId)) {
      throw new Error('Identifiants manquants.');
    }

    const utilisateur = await this.auth.utilisateurDepuisJeton(jeton);
    socket.data.membre = await this.auth.membreActif(
      utilisateur,
      etablissementId,
      [RoleMembre.ENSEIGNANT],
    );
  }

  // Les évaluations que quelqu'un suit en ce moment (celles dont la salle n'est pas vide).
  private evaluationsSuivies(): string[] {
    const ids: string[] = [];
    for (const [salle, sockets] of this.serveur.adapter.rooms) {
      if (
        typeof salle === 'string' &&
        salle.startsWith(PREFIXE_SALLE) &&
        sockets.size > 0
      ) {
        ids.push(salle.slice(PREFIXE_SALLE.length));
      }
    }
    return ids;
  }

  private suiviActif(evaluationId: string): boolean {
    return this.serveur.adapter.rooms.has(salleDe(evaluationId));
  }

  // Un événement venu du reste du serveur.
  private async traiter(evenement: EvenementSuivi): Promise<void> {
    try {
      if (!this.suiviActif(evenement.evaluationId)) return; // personne ne suit : rien à faire

      if (evenement.type === 'incident') {
        this.serveur
          .to(salleDe(evenement.evaluationId))
          .emit('incident', evenement.incident);
        return;
      }
      if (evenement.participationId) {
        await this.diffuserEtudiant(
          evenement.evaluationId,
          evenement.participationId,
        );
      } else {
        await this.diffuserEvaluation(evenement.evaluationId);
      }
    } catch (erreur) {
      this.logger.error(
        'Échec de la diffusion du suivi',
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
    }
  }

  // Envoie la ligne d'UN étudiant (si elle a changé).
  private async diffuserEtudiant(
    evaluationId: string,
    participationId: string,
  ): Promise<void> {
    const ligne = await this.suivi.ligneEtudiant(evaluationId, participationId);
    if (!ligne) return;
    const connues =
      this.clesConnues.get(evaluationId) ?? new Map<string, string>();
    const cle = cleChangement(ligne);
    if (connues.get(participationId) === cle) return;
    connues.set(participationId, cle);
    this.clesConnues.set(evaluationId, connues);
    this.serveur.to(salleDe(evaluationId)).emit('etudiant:maj', ligne);
  }

  // Envoie toutes les lignes qui ont changé dans UNE évaluation, et son état si besoin.
  private async diffuserEvaluation(evaluationId: string): Promise<void> {
    const instantane = await this.suivi.instantane(evaluationId);
    const salle = salleDe(evaluationId);
    const connues =
      this.clesConnues.get(evaluationId) ?? new Map<string, string>();

    for (const ligne of instantane.etudiants) {
      const cle = cleChangement(ligne);
      if (connues.get(ligne.participationId) !== cle) {
        connues.set(ligne.participationId, cle);
        this.serveur.to(salle).emit('etudiant:maj', ligne);
      }
    }
    this.clesConnues.set(evaluationId, connues);

    const statut = instantane.evaluation.statut;
    if (this.statutsConnus.get(evaluationId) !== statut) {
      this.statutsConnus.set(evaluationId, statut);
      this.serveur.to(salle).emit('evaluation:maj', { statut });
    }
  }
}