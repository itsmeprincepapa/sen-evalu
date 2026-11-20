import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Incident } from '../database/entities/incident.entity';
import { Membre } from '../database/entities/membre.entity';
import { Participation } from '../database/entities/participation.entity';
import {
  GraviteIncident,
  StatutEvaluation,
  StatutParticipation,
  TypeIncident,
} from '../database/enums';
import { calculerFinPrevue } from '../passage/chrono';
import { MARGE_FIN_SECONDES } from '../passage/constantes';
import { etatConnexion } from './etat-connexion';

// Le suivi d'une évaluation par son enseignant : état des étudiants, journal, actions.
// Toutes les méthodes vérifient que l'évaluation appartient à CET enseignant.
@Injectable()
export class SuiviService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
  ) {}

  // ---------------------------------------------------------------------------
  // ÉTAT : la liste des étudiants (validés ou plus avancés) avec leur situation.
  // ---------------------------------------------------------------------------
  async etat(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    const participations = await this.participations.find({
      where: {
        evaluationId: evaluation.id,
        statut: In([
          StatutParticipation.VALIDE,
          StatutParticipation.EN_COURS,
          StatutParticipation.EXCLU,
          StatutParticipation.TERMINE,
        ]),
      },
      order: { nom: 'ASC', prenom: 'ASC' },
    });

    const maintenant = Date.now();
    return {
      evaluation: {
        id: evaluation.id,
        titre: evaluation.titre,
        statut: evaluation.statut,
        debut: evaluation.debut,
        fin: evaluation.fin,
        dureeMinutes: evaluation.dureeMinutes,
        toleranceCoupureSecondes: evaluation.toleranceCoupureSecondes,
        seuilIncidentsGraves: evaluation.seuilIncidentsGraves,
      },
      etudiants: participations.map((p) => ({
        participationId: p.id,
        nom: p.nom,
        prenom: p.prenom,
        email: p.email,
        statut: p.statut,
        connexion: etatConnexion(
          p,
          evaluation.toleranceCoupureSecondes,
          maintenant,
        ),
        nbIncidentsGraves: p.nbIncidentsGraves,
        tempsSupplementaireSecondes: p.tempsSupplementaireSecondes,
        tempsRestantSecondes: this.tempsRestant(p, maintenant),
        derniereActiviteAt: p.derniereActiviteAt,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // JOURNAL : tous les incidents de l'évaluation, du plus récent au plus ancien.
  // ---------------------------------------------------------------------------
  async journal(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    const lignes = await this.incidents.find({
      where: { participation: { evaluationId: evaluation.id } },
      relations: { participation: true },
      order: { creeLe: 'DESC' },
      take: 500,
    });
    return lignes.map((i) => ({
      id: i.id,
      heure: i.creeLe,
      type: i.type,
      gravite: i.gravite,
      details: i.details,
      participationId: i.participationId,
      nom: i.participation.nom,
      prenom: i.participation.prenom,
    }));
  }

  // ---------------------------------------------------------------------------
  // TEMPS SUPPLÉMENTAIRE pour un étudiant précis. Le chronomètre est recalculé.
  // Le temps reste plafonné par la fin de la plage horaire : si le plafond joue,
  // la réponse le signale (« limiteParLaPlage »).
  // ---------------------------------------------------------------------------
  async accorderTemps(
    membre: Membre,
    evaluationId: string,
    participationId: string,
    minutes: number,
  ) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    if (
      evaluation.statut !== StatutEvaluation.PLANIFIEE &&
      evaluation.statut !== StatutEvaluation.EN_COURS
    ) {
      throw new ConflictException('Cette évaluation est terminée.');
    }
    const participation = await this.participationDe(evaluation, participationId);

    const statutsPermis = [
      StatutParticipation.VALIDE,
      StatutParticipation.EN_COURS,
      StatutParticipation.EXCLU,
    ];
    if (!statutsPermis.includes(participation.statut)) {
      throw new ConflictException(
        'Le temps supplémentaire ne peut être accordé qu’à un étudiant qui n’a pas terminé.',
      );
    }

    const total = participation.tempsSupplementaireSecondes + minutes * 60;

    // Pas encore entré : le temps sera pris en compte à son entrée.
    if (!participation.debutAt) {
      await this.participations.update(participation.id, {
        tempsSupplementaireSecondes: total,
      });
      return {
        tempsSupplementaireSecondes: total,
        tempsRestantSecondes: null,
        limiteParLaPlage: false,
      };
    }

    const finPrevue = calculerFinPrevue(
      participation.debutAt,
      evaluation.dureeMinutes,
      total,
      evaluation.fin,
    );
    // Le plafond joue si « début + durée + temps supplémentaire » dépasse la fin de la plage.
    const sansPlafond =
      participation.debutAt.getTime() +
      evaluation.dureeMinutes * 60_000 +
      total * 1000;
    await this.participations.update(participation.id, {
      tempsSupplementaireSecondes: total,
      finPrevueAt: finPrevue,
    });
    return {
      tempsSupplementaireSecondes: total,
      tempsRestantSecondes: Math.max(
        0,
        Math.floor((finPrevue.getTime() - Date.now()) / 1000),
      ),
      limiteParLaPlage: sansPlafond > evaluation.fin.getTime(),
    };
  }

  // ---------------------------------------------------------------------------
  // RÉINTÉGRER un étudiant exclu. Le chronomètre a continué pendant l'exclusion.
  // L'étudiant doit ressaisir le code d'accès (sa session est effacée) ; ses réponses
  // sont retrouvées. Le compteur d'incidents graves repart à zéro.
  // ---------------------------------------------------------------------------
  async reintegrer(
    membre: Membre,
    evaluationId: string,
    participationId: string,
    minutes?: number,
  ) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    if (evaluation.statut !== StatutEvaluation.EN_COURS) {
      throw new ConflictException('Cette évaluation n’est pas en cours.');
    }
    const participation = await this.participationDe(evaluation, participationId);
    if (
      participation.statut !== StatutParticipation.EXCLU ||
      !participation.debutAt
    ) {
      throw new ConflictException('Seul un étudiant exclu peut être réintégré.');
    }

    const total = participation.tempsSupplementaireSecondes + (minutes ?? 0) * 60;
    const finPrevue = calculerFinPrevue(
      participation.debutAt,
      evaluation.dureeMinutes,
      total,
      evaluation.fin,
    );
    // Le temps est déjà écoulé : le réintégrer ne servirait à rien.
    if (finPrevue.getTime() + MARGE_FIN_SECONDES * 1000 < Date.now()) {
      throw new ConflictException(
        'Le temps de cet étudiant est écoulé : accordez-lui du temps supplémentaire pour le réintégrer.',
      );
    }

    await this.participations.update(participation.id, {
      statut: StatutParticipation.EN_COURS,
      nbIncidentsGraves: 0,
      sessionId: null, // il devra ressaisir le code d'accès
      tempsSupplementaireSecondes: total,
      finPrevueAt: finPrevue,
    });
    await this.incidents.save(
      this.incidents.create({
        participationId: participation.id,
        type: TypeIncident.REINTEGRATION,
        gravite: GraviteIncident.INFORMATION,
        details: minutes
          ? `Réintégré par l’enseignant (+${minutes} min)`
          : 'Réintégré par l’enseignant',
      }),
    );
    return {
      ok: true,
      tempsRestantSecondes: Math.max(
        0,
        Math.floor((finPrevue.getTime() - Date.now()) / 1000),
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // AUTORISER LA RECONNEXION d'un étudiant en cours (nouvel appareil, onglet fermé...).
  // On efface sa session : sa prochaine entrée avec le code d'accès sera acceptée, et
  // l'ancien onglet, s'il existe encore, sera refusé.
  // ---------------------------------------------------------------------------
  async autoriserReconnexion(
    membre: Membre,
    evaluationId: string,
    participationId: string,
  ) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    const participation = await this.participationDe(evaluation, participationId);
    if (participation.statut !== StatutParticipation.EN_COURS) {
      throw new ConflictException(
        'La reconnexion ne concerne qu’un étudiant dont l’évaluation est en cours (pour un exclu, utilisez « Réintégrer »).',
      );
    }

    await this.participations.update(participation.id, { sessionId: null });
    await this.incidents.save(
      this.incidents.create({
        participationId: participation.id,
        type: TypeIncident.RECONNEXION,
        gravite: GraviteIncident.INFORMATION,
        details: 'Reconnexion autorisée par l’enseignant',
      }),
    );
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // TERMINER POUR TOUS : fin anticipée de l'évaluation. Les étudiants en cours sont
  // terminés (leurs réponses déjà envoyées sont conservées) ; les exclus restent exclus.
  // ---------------------------------------------------------------------------
  async terminerPourTous(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    if (evaluation.statut !== StatutEvaluation.EN_COURS) {
      throw new ConflictException('Cette évaluation n’est pas en cours.');
    }

    const resultat = await this.participations.update(
      { evaluationId: evaluation.id, statut: StatutParticipation.EN_COURS },
      { statut: StatutParticipation.TERMINE },
    );
    await this.evaluations.update(evaluation.id, {
      statut: StatutEvaluation.TERMINEE,
    });
    return { terminees: resultat.affected ?? 0 };
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Retrouve l'évaluation SEULEMENT si elle appartient à CET enseignant, dans CET
  // établissement. Sinon : « introuvable ».
  private async evaluationDuProprietaire(
    membre: Membre,
    evaluationId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluations.findOneBy({
      id: evaluationId,
      etablissementId: membre.etablissementId,
      membreId: membre.id,
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable.');
    return evaluation;
  }

  // Retrouve un étudiant, SEULEMENT s'il participe à cette évaluation.
  private async participationDe(
    evaluation: Evaluation,
    participationId: string,
  ): Promise<Participation> {
    const participation = await this.participations.findOneBy({
      id: participationId,
      evaluationId: evaluation.id,
    });
    if (!participation) throw new NotFoundException('Étudiant introuvable.');
    return participation;
  }

  // Temps restant en secondes pour un étudiant dont le chronomètre tourne (en cours ou
  // exclu : le chronomètre continue pendant l'exclusion) ; sinon « null ».
  private tempsRestant(participation: Participation, maintenant: number): number | null {
    const tourne =
      participation.statut === StatutParticipation.EN_COURS ||
      participation.statut === StatutParticipation.EXCLU;
    if (!tourne || !participation.finPrevueAt) return null;
    return Math.max(
      0,
      Math.floor((participation.finPrevueAt.getTime() - maintenant) / 1000),
    );
  }
}