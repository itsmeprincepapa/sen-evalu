import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verifierCode } from '../common/codes';
import { melangerStable } from '../common/melange';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Incident } from '../database/entities/incident.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { Reponse } from '../database/entities/reponse.entity';
import {
  GraviteIncident,
  StatutEtablissement,
  StatutEvaluation,
  StatutParticipation,
  TypeIncident,
  TypeQuestion,
} from '../database/enums';
import { BusSuivi } from '../suivi/bus-suivi';
import { versLigneJournal } from '../suivi/types';
import { calculerFinPrevue } from './chrono';
import { MARGE_FIN_SECONDES } from './constantes';
import { EntrerDto } from './dto/entrer.dto';
import { PingDto } from './dto/ping.dto';
import { SauvegarderDto } from './dto/sauvegarder.dto';
import { SignalerIncidentDto } from './dto/signaler-incident.dto';
import { TerminerDto } from './dto/terminer.dto';

// Taille maximale d'une réponse rédigée ou d'un programme (en caractères).
const LONGUEUR_MAX_TEXTE = 20_000;

// Deux signaux d'incident grave reçus à moins de 2 secondes d'intervalle comptent pour UN
// seul incident : une même action de l'étudiant peut déclencher deux événements du navigateur.
const DELAI_ANTI_DOUBLON_MS = 2_000;

// L'interface envoie un signal toutes les 10 secondes. Tant que le silence reste sous
// 15 secondes, c'est normal : on ne cherche même pas s'il y a eu une coupure.
const SILENCE_NORMAL_MS = 15_000;

@Injectable()
export class PassageService {
  // Le « logger » écrit dans le terminal du serveur : utile pour comprendre un refus.
  private readonly logger = new Logger(PassageService.name);

  // Heure du dernier incident grave de chaque participation (gardée en mémoire du serveur :
  // c'est cohérent avec « un seul serveur », et ces valeurs n'ont d'intérêt que quelques secondes).
  private readonly dernierIncidentGrave = new Map<string, number>();

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Etablissement)
    private readonly etablissements: Repository<Etablissement>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
    @InjectRepository(Reponse)
    private readonly reponses: Repository<Reponse>,
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    // Le « bus » du suivi : sert à prévenir l'enseignant, en temps réel, de ce qui se passe.
    private readonly bus: BusSuivi,
  ) {}

  // ---------------------------------------------------------------------------
  // ENTRER : l'étudiant tape son e-mail et le code d'accès.
  // Première entrée : le chronomètre démarre. Entrée suivante : c'est une REPRISE.
  // ---------------------------------------------------------------------------
  async entrer(dto: EntrerDto) {
    const maintenant = new Date();
    const email = dto.email.trim().toLowerCase();

    // 1. L'évaluation existe-t-elle ?
    const evaluation = await this.evaluations.findOneBy({ lien: dto.lien });
    // Un brouillon n'est pas encore ouvert aux étudiants : même réponse qu'un lien faux.
    if (!evaluation || evaluation.statut === StatutEvaluation.BROUILLON) {
      throw this.refus('lien inconnu');
    }
    // Évaluation terminée (fin anticipée, plage horaire finie...) : plus personne n'entre.
    if (
      evaluation.statut === StatutEvaluation.TERMINEE ||
      evaluation.statut === StatutEvaluation.CORRIGEE ||
      evaluation.statut === StatutEvaluation.PUBLIEE
    ) {
      throw new ForbiddenException({
        code: 'EVALUATION_TERMINEE',
        message: 'Cette évaluation est terminée.',
      });
    }
    // Établissement désactivé par le super-administrateur : les évaluations déjà commencées
    // (statut « en cours ») se terminent normalement, mais aucune nouvelle ne démarre.
    if (evaluation.statut !== StatutEvaluation.EN_COURS) {
      const etablissement = await this.etablissements.findOneBy({
        id: evaluation.etablissementId,
      });
      if (etablissement?.statut !== StatutEtablissement.ACTIF) {
        throw this.refus('établissement inactif');
      }
    }

    // 2. Sommes-nous dans la plage horaire de l'évaluation ?
    if (maintenant < evaluation.debut || maintenant > evaluation.fin) {
      throw this.refus('hors de la plage horaire');
    }

    // 3. Cet e-mail est-il inscrit à cette évaluation ?
    const participation = await this.participations.findOneBy({
      evaluationId: evaluation.id,
      email,
    });
    if (!participation) throw this.refus('e-mail absent de la liste');

    // 4. Le code d'accès est-il le bon ?
    // Les codes sont enregistrés en majuscules : on normalise la saisie de la même façon.
    const codeBon = await verifierCode(
      dto.codeAcces.trim().toUpperCase(),
      evaluation.codeAccesHash,
    );
    if (!codeBon) throw this.refus('code d’accès faux');

    // 5. Que faire selon la situation de l'étudiant ?
    if (participation.statut === StatutParticipation.VALIDE) {
      // Première entrée : on démarre le chronomètre.
      participation.debutAt = maintenant;
      participation.finPrevueAt = calculerFinPrevue(
        maintenant,
        evaluation.dureeMinutes,
        participation.tempsSupplementaireSecondes,
        evaluation.fin,
      );
      participation.statut = StatutParticipation.EN_COURS;
    } else if (participation.statut === StatutParticipation.EN_COURS) {
      // Reprise après une coupure : le chronomètre n'a jamais été arrêté.
      // Si le temps est écoulé entre-temps, on clôture.
      if (this.tempsEcoule(participation)) {
        await this.cloturer(participation);
        throw new ForbiddenException({
          code: 'TEMPS_ECOULE',
          message: 'Le temps est écoulé.',
        });
      }

      // SESSION UNIQUE : si une session est déjà ouverte, cette seconde connexion est
      // BLOQUÉE. L'enseignant doit autoriser la reconnexion (cela efface la session).
      if (participation.sessionId !== null) {
        this.logger.warn(
          `Seconde connexion bloquée pour la participation ${participation.id}`,
        );
        throw new ForbiddenException({
          code: 'SESSION_DEJA_OUVERTE',
          message:
            'Vous êtes déjà connecté (autre onglet ou autre appareil). Demandez à votre enseignant d’autoriser la reconnexion.',
        });
      }
    } else if (participation.statut === StatutParticipation.EXCLU) {
      // Exclu pour incidents graves : seul l'enseignant peut le réintégrer.
      // (Le code d'accès a été vérifié juste avant : on peut donc expliquer la situation.)
      throw new ForbiddenException({
        code: 'EXCLU',
        message:
          'Vous avez été exclu de cette évaluation. Seul votre enseignant peut vous réintégrer.',
      });
    } else {
      // En attente, refusé ou terminé : pas d'accès.
      throw this.refus(`statut « ${participation.statut} »`);
    }

    // 6. Ouverture de la session. On n'arrive ici que pour la PREMIÈRE entrée, ou après
    // une autorisation de reconnexion de l'enseignant (qui a effacé l'ancienne session).
    // Si un ancien onglet existe encore, il sera refusé à sa prochaine requête.
    participation.sessionId = randomBytes(24).toString('hex');
    participation.derniereActiviteAt = maintenant;
    await this.participations.save(participation);

    // 7. L'évaluation passe « en cours » dès la première entrée d'un étudiant.
    if (evaluation.statut === StatutEvaluation.PLANIFIEE) {
      await this.evaluations.update(evaluation.id, {
        statut: StatutEvaluation.EN_COURS,
      });
    }

    // L'enseignant qui suit l'évaluation voit tout de suite l'étudiant arriver.
    this.annoncerChangement(participation);

    // On renvoie le jeton et tout l'état de l'évaluation.
    return {
      jeton: participation.sessionId,
      ...(await this.construireEtat(participation)),
    };
  }

  // ---------------------------------------------------------------------------
  // ÉTAT : questions, réponses déjà saisies et temps restant (utile après un
  // rechargement de la page ou une coupure).
  // ---------------------------------------------------------------------------
  async etat(participation: Participation) {
    await this.verifierPeutRepondre(participation);
    return this.construireEtat(participation);
  }

  // ---------------------------------------------------------------------------
  // SAUVEGARDER : enregistre la réponse à UNE question.
  // Chaque sauvegarde REMPLACE la précédente, sauf si elle est plus ancienne.
  // ---------------------------------------------------------------------------
  async sauvegarder(
    participation: Participation,
    questionId: string,
    dto: SauvegarderDto,
  ) {
    await this.verifierPeutRepondre(participation);

    // La question doit appartenir à CETTE évaluation.
    const question = await this.questions.findOneBy({
      id: questionId,
      evaluationId: participation.evaluationId,
    });
    if (!question) throw new NotFoundException('Question introuvable.');

    this.verifierContenu(question, dto.contenu);

    // A-t-on déjà une réponse enregistrée pour cette question ?
    const existante = await this.reponses.findOneBy({
      participationId: participation.id,
      questionId,
    });

    // Numéro de version trop ancien (ou envoi répété après une coupure) : on l'ignore,
    // car ce qui est déjà enregistré est plus récent. Ce n'est PAS une erreur.
    if (existante && dto.version <= existante.version) {
      return this.accuse(participation, true, existante.version);
    }

    try {
      const reponse =
        existante ??
        this.reponses.create({ participationId: participation.id, questionId });
      reponse.contenu = dto.contenu;
      reponse.version = dto.version;
      await this.reponses.save(reponse);
    } catch (erreur) {
      // Deux sauvegardes de la même question arrivées en même temps : l'index unique
      // refuse la deuxième. L'autre a déjà enregistré, on l'ignore.
      if (this.estDoublon(erreur)) {
        return this.accuse(participation, true, dto.version);
      }
      throw erreur;
    }

    await this.marquerActivite(participation);
    return this.accuse(participation, false, dto.version);
  }

  // ---------------------------------------------------------------------------
  // PING : « je suis toujours là ». Sert à afficher « connecté » ou « coupé » à
  // l'enseignant, et à recaler le minuteur de l'étudiant. Il peut porter le numéro de la
  // question affichée, que l'enseignant voit dans le suivi en direct.
  // ---------------------------------------------------------------------------
  async ping(participation: Participation, dto: PingDto) {
    await this.verifierPeutRepondre(participation);
    await this.marquerActivite(participation);
    if (dto.question !== undefined) {
      this.bus.noterQuestion(participation.id, dto.question);
    }
    return {
      ok: true,
      tempsRestantSecondes: this.tempsRestantSecondes(participation),
    };
  }

  // ---------------------------------------------------------------------------
  // SIGNALER UN INCIDENT : l'interface a détecté une sortie du plein écran ou un
  // changement d'onglet. Règles : 1er incident grave = avertissement ; quand le nombre
  // d'incidents graves atteint le seuil (2 par défaut) = exclusion.
  // Le chronomètre continue pendant l'exclusion ; seul l'enseignant peut réintégrer.
  // ---------------------------------------------------------------------------
  async signalerIncident(
    participation: Participation,
    dto: SignalerIncidentDto,
  ) {
    // Refuse si la participation est terminée, exclue ou si le temps est écoulé.
    await this.verifierPeutRepondre(participation);

    const evaluation = await this.evaluations.findOneByOrFail({
      id: participation.evaluationId,
    });
    const seuil = evaluation.seuilIncidentsGraves;

    // Réponse « rien à compter » : l'incident est ignoré.
    const ignore = {
      ok: true,
      ignore: true,
      exclu: false,
      nbIncidentsGraves: participation.nbIncidentsGraves,
      seuil,
    };

    // L'enseignant peut désactiver chaque surveillance : l'incident est alors ignoré.
    const surveille =
      dto.type === TypeIncident.SORTIE_PLEIN_ECRAN
        ? evaluation.pleinEcranObligatoire
        : evaluation.detecterChangementOnglet;
    if (!surveille) return ignore;

    // Anti-doublon : un même geste peut produire deux signaux presque simultanés.
    const maintenant = Date.now();
    const precedent = this.dernierIncidentGrave.get(participation.id);
    if (precedent !== undefined && maintenant - precedent < DELAI_ANTI_DOUBLON_MS) {
      return ignore;
    }
    this.dernierIncidentGrave.set(participation.id, maintenant);
    this.purgerAntiDoublon(maintenant);

    // On enregistre l'incident dans le journal et on augmente le compteur.
    const incident = await this.incidents.save(
      this.incidents.create({
        participationId: participation.id,
        type: dto.type,
        gravite: GraviteIncident.GRAVE,
        details: null,
      }),
    );
    this.annoncerIncident(participation, incident); // alerte en temps réel à l'enseignant
    await this.participations.increment(
      { id: participation.id },
      'nbIncidentsGraves',
      1,
    );
    const misAJour = await this.participations.findOneByOrFail({
      id: participation.id,
    });
    const nb = misAJour.nbIncidentsGraves;

    // Seuil atteint : exclusion. Le jeton de session reste valable pour que l'étudiant
    // reçoive ensuite un refus clair (code « EXCLU ») ; ses réponses déjà envoyées restent
    // enregistrées.
    if (nb >= seuil) {
      await this.participations.update(participation.id, {
        statut: StatutParticipation.EXCLU,
      });
      const exclusion = await this.incidents.save(
        this.incidents.create({
          participationId: participation.id,
          type: TypeIncident.EXCLUSION,
          gravite: GraviteIncident.GRAVE,
          details: `Seuil de ${seuil} incident(s) grave(s) atteint`,
        }),
      );
      this.annoncerIncident(participation, exclusion);
      this.annoncerChangement(participation);
      this.logger.warn(`Étudiant exclu : participation ${participation.id}`);
      return {
        ok: true,
        ignore: false,
        exclu: true,
        nbIncidentsGraves: nb,
        seuil,
      };
    }

    this.annoncerChangement(participation);
    return {
      ok: true,
      ignore: false,
      exclu: false,
      nbIncidentsGraves: nb,
      seuil,
    };
  }

  // ---------------------------------------------------------------------------
  // TERMINER : l'étudiant a fini. Il doit fournir le CODE DE SORTIE donné par
  // l'enseignant. Un mauvais code est refusé : la participation reste en cours.
  // ---------------------------------------------------------------------------
  async terminer(participation: Participation, dto: TerminerDto) {
    // Déjà terminée (temps écoulé, exclusion...) : il n'y a rien à faire.
    if (participation.statut !== StatutParticipation.EN_COURS) {
      return { ok: true };
    }

    // Temps écoulé : on clôture sans exiger le code (l'étudiant n'a plus rien à faire).
    if (this.tempsEcoule(participation)) {
      await this.cloturer(participation);
      return { ok: true };
    }

    // Le code de sortie est enregistré en majuscules : on normalise la saisie pareil.
    const evaluation = await this.evaluations.findOneByOrFail({
      id: participation.evaluationId,
    });
    const codeBon = await verifierCode(
      dto.codeSortie.trim().toUpperCase(),
      evaluation.codeSortieHash,
    );
    if (!codeBon) {
      // Statut 400 (et non 403) : l'interface comprend ainsi que c'est un simple
      // mauvais code, et non une participation déjà terminée.
      throw new BadRequestException({
        code: 'CODE_SORTIE_FAUX',
        message: 'Code de sortie incorrect.',
      });
    }

    await this.cloturer(participation);
    return { ok: true };
  }

  // ===========================================================================
  // Fonctions internes (non exposées)
  // ===========================================================================

  // Temps restant en secondes (jamais négatif), calculé avec l'horloge du SERVEUR.
  private tempsRestantSecondes(participation: Participation): number {
    if (!participation.finPrevueAt) return 0;
    const reste = participation.finPrevueAt.getTime() - Date.now();
    return Math.max(0, Math.floor(reste / 1000));
  }

  // Le temps est-il écoulé (marge de quelques secondes comprise) ?
  private tempsEcoule(participation: Participation): boolean {
    if (!participation.finPrevueAt) return true;
    const limite =
      participation.finPrevueAt.getTime() + MARGE_FIN_SECONDES * 1000;
    return Date.now() > limite;
  }

  // Termine la participation (temps écoulé ou sortie volontaire).
  private async cloturer(participation: Participation): Promise<void> {
    participation.statut = StatutParticipation.TERMINE;
    await this.participations.update(participation.id, {
      statut: StatutParticipation.TERMINE,
    });
    this.annoncerChangement(participation);
  }

  // Vérifie que l'étudiant peut encore répondre ; sinon refuse avec un « code »
  // que l'interface lit pour afficher le bon message de fin.
  private async verifierPeutRepondre(
    participation: Participation,
  ): Promise<void> {
    // Exclu : l'interface affiche l'écran d'exclusion (les réponses sont conservées).
    if (participation.statut === StatutParticipation.EXCLU) {
      throw new ForbiddenException({
        code: 'EXCLU',
        message: 'Vous avez été exclu de l’évaluation.',
      });
    }
    if (participation.statut !== StatutParticipation.EN_COURS) {
      throw new ForbiddenException({
        code: 'TERMINE',
        message: 'Votre participation est terminée.',
      });
    }
    if (this.tempsEcoule(participation)) {
      await this.cloturer(participation);
      throw new ForbiddenException({
        code: 'TEMPS_ECOULE',
        message: 'Le temps est écoulé.',
      });
    }
  }

  // Vérifie que le contenu envoyé est cohérent avec le type de la question.
  private verifierContenu(question: Question, contenu: unknown): void {
    const estQcm =
      question.type === TypeQuestion.QCM_UNIQUE ||
      question.type === TypeQuestion.QCM_MULTIPLE;

    if (estQcm) {
      // Un QCM attend une liste d'identifiants de propositions (ex. ["a", "c"]).
      if (!Array.isArray(contenu) || contenu.some((c) => typeof c !== 'string')) {
        throw new BadRequestException(
          'Un QCM attend une liste d’identifiants de réponses.',
        );
      }
      const idsValides = new Set((question.options ?? []).map((o) => o.id));
      if (contenu.some((c) => !idsValides.has(c))) {
        throw new BadRequestException('Réponse inconnue pour ce QCM.');
      }
      if (new Set(contenu).size !== contenu.length) {
        throw new BadRequestException('Réponse cochée en double.');
      }
      if (question.type === TypeQuestion.QCM_UNIQUE && contenu.length > 1) {
        throw new BadRequestException('Une seule réponse est permise.');
      }
      return;
    }

    // Les autres types (rédaction, réponse courte, code) attendent un texte.
    if (typeof contenu !== 'string') {
      throw new BadRequestException('Cette question attend un texte.');
    }
    if (contenu.length > LONGUEUR_MAX_TEXTE) {
      throw new BadRequestException('Réponse trop longue.');
    }
  }

  // Construit ce que l'interface reçoit : questions, réponses, temps restant.
  private async construireEtat(participation: Participation) {
    const evaluation = await this.evaluations.findOneByOrFail({
      id: participation.evaluationId,
    });
    const questionsEnBase = await this.questions.find({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'ASC' },
    });
    const reponses = await this.reponses.findBy({
      participationId: participation.id,
    });

    // MÉLANGE (option de l'enseignant) : l'ordre des questions ET celui des propositions
    // des QCM sont mélangés, différemment pour chaque étudiant, mais de façon STABLE :
    // même ordre à chaque rechargement ou reprise (la graine est l'identifiant de la
    // participation, qui ne change jamais).
    const melanger = evaluation.melangerQuestions;
    const questions = melanger
      ? melangerStable(questionsEnBase, participation.id)
      : questionsEnBase;

    return {
      statut: participation.statut,
      etudiant: { nom: participation.nom, prenom: participation.prenom },
      evaluation: {
        titre: evaluation.titre,
        navigationLibre: evaluation.navigationLibre,
        retourEnArriere: evaluation.retourEnArriere,
        melangerQuestions: evaluation.melangerQuestions,
        pleinEcranObligatoire: evaluation.pleinEcranObligatoire,
        detecterChangementOnglet: evaluation.detecterChangementOnglet,
      },
      // ATTENTION : on ENLÈVE « correcte » des propositions : l'étudiant ne doit
      // jamais recevoir les bonnes réponses.
      questions: questions.map((q) => ({
        id: q.id,
        ordre: q.ordre,
        type: q.type,
        enonce: q.enonce,
        points: q.points,
        langage: q.langage,
        options: q.options
          ? (melanger
              ? melangerStable(q.options, `${participation.id}:${q.id}`)
              : q.options
            ).map((o) => ({ id: o.id, texte: o.texte }))
          : null,
      })),
      // Les réponses déjà enregistrées (pour la reprise).
      reponses: reponses.map((r) => ({
        questionId: r.questionId,
        contenu: r.contenu,
        version: r.version,
      })),
      tempsRestantSecondes: this.tempsRestantSecondes(participation),
      // L'heure du serveur permet à l'interface de vérifier le décalage de son horloge.
      heureServeur: new Date().toISOString(),
    };
  }

  // Réponse type d'une sauvegarde : l'interface apprend si l'envoi a été ignoré
  // et se recale sur le temps restant du serveur.
  private accuse(participation: Participation, ignoree: boolean, version: number) {
    return {
      ok: true,
      ignoree,
      version,
      tempsRestantSecondes: this.tempsRestantSecondes(participation),
    };
  }

  // Enregistre le dernier signal de vie de l'étudiant. Si le silence précédent a dépassé
  // la tolérance de coupure, la coupure est d'abord écrite dans le journal.
  private async marquerActivite(participation: Participation): Promise<void> {
    const maintenant = new Date();
    await this.noterCoupureSiBesoin(participation, maintenant);
    await this.participations.update(participation.id, {
      derniereActiviteAt: maintenant,
    });
  }

  // COUPURE : si l'étudiant redonne signe de vie après un silence plus long que la
  // tolérance de l'évaluation (60 secondes par défaut), on écrit « coupure » (avec sa
  // durée) et « reconnexion » dans le journal. Gravité « information » : cela ne compte
  // pas pour l'exclusion.
  private async noterCoupureSiBesoin(
    participation: Participation,
    maintenant: Date,
  ): Promise<void> {
    const dernier = participation.derniereActiviteAt;
    if (!dernier) return;
    const silenceMs = maintenant.getTime() - dernier.getTime();

    // Cas normal : on évite une requête supplémentaire à chaque signal.
    if (silenceMs <= SILENCE_NORMAL_MS) return;

    const evaluation = await this.evaluations.findOneByOrFail({
      id: participation.evaluationId,
    });
    // Coupure tolérée : pas notée.
    if (silenceMs <= evaluation.toleranceCoupureSecondes * 1000) return;

    const secondes = Math.round(silenceMs / 1000);
    const lignes = await this.incidents.save([
      this.incidents.create({
        participationId: participation.id,
        type: TypeIncident.COUPURE,
        gravite: GraviteIncident.INFORMATION,
        details: `Connexion coupée pendant environ ${secondes} s`,
      }),
      this.incidents.create({
        participationId: participation.id,
        type: TypeIncident.RECONNEXION,
        gravite: GraviteIncident.INFORMATION,
        details: null,
      }),
    ]);
    for (const ligne of lignes) this.annoncerIncident(participation, ligne);
    this.annoncerChangement(participation);
  }

  // Prévient le suivi en direct qu'un étudiant a changé de situation.
  private annoncerChangement(participation: Participation): void {
    this.bus.publier({
      type: 'changement',
      evaluationId: participation.evaluationId,
      participationId: participation.id,
    });
  }

  // Prévient le suivi en direct d'une nouvelle ligne du journal (alerte en temps réel).
  private annoncerIncident(
    participation: Participation,
    incident: Incident,
  ): void {
    this.bus.publier({
      type: 'incident',
      evaluationId: participation.evaluationId,
      incident: versLigneJournal(incident, participation),
    });
  }

  // Supprime de temps en temps les heures d'incident trop anciennes (elles ne servent
  // que pendant quelques secondes) : sans cela, la liste grossirait sans fin.
  private purgerAntiDoublon(maintenant: number): void {
    if (this.dernierIncidentGrave.size < 1000) return;
    for (const [id, heure] of this.dernierIncidentGrave) {
      if (maintenant - heure > 60_000) this.dernierIncidentGrave.delete(id);
    }
  }

  // Reconnaît l'erreur MySQL « entrée en double » (index unique violé).
  private estDoublon(erreur: unknown): boolean {
    const code = (erreur as { driverError?: { code?: string } })?.driverError
      ?.code;
    return code === 'ER_DUP_ENTRY';
  }

  // Refus d'entrée : le MESSAGE est volontairement le même pour toutes les causes
  // (on ne dit pas si c'est l'e-mail ou le code qui est faux). La vraie raison
  // est écrite seulement dans le terminal du serveur.
  private refus(raison: string): ForbiddenException {
    this.logger.warn(`Entrée refusée : ${raison}`);
    return new ForbiddenException(
      'Accès refusé. Vérifiez votre e-mail et le code d’accès.',
    );
  }
}