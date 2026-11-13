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
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { Reponse } from '../database/entities/reponse.entity';
import {
  StatutEtablissement,
  StatutEvaluation,
  StatutParticipation,
  TypeQuestion,
} from '../database/enums';
import { EntrerDto } from './dto/entrer.dto';
import { SauvegarderDto } from './dto/sauvegarder.dto';
import { MARGE_FIN_SECONDES } from './constantes';
import { Etablissement } from '../database/entities/etablissement.entity';

// Taille maximale d'une réponse rédigée ou d'un programme (en caractères).
const LONGUEUR_MAX_TEXTE = 20_000;

@Injectable()
export class PassageService {
  // Le « logger » écrit dans le terminal du serveur : utile pour comprendre un refus.
  private readonly logger = new Logger(PassageService.name);

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
    if (!evaluation) throw this.refus('lien inconnu');
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
    const codeBon = await verifierCode(dto.codeAcces, evaluation.codeAccesHash);
    if (!codeBon) throw this.refus('code d’accès faux');

    // 5. Que faire selon la situation de l'étudiant ?
    if (participation.statut === StatutParticipation.VALIDE) {
      // Première entrée : on démarre le chronomètre.
      participation.debutAt = maintenant;
      participation.finPrevueAt = this.calculerFinPrevue(
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
    } else {
      // En attente, refusé, exclu ou terminé : pas d'accès.
      throw this.refus(`statut « ${participation.statut} »`);
    }

    // 6. Nouvelle session : un nouveau jeton REMPLACE l'ancien.
    // L'ancien onglet sera refusé à sa prochaine requête.
    participation.sessionId = randomBytes(24).toString('hex');
    participation.derniereActiviteAt = maintenant;
    await this.participations.save(participation);

    // 7. L'évaluation passe « en cours » dès la première entrée d'un étudiant.
    if (evaluation.statut === StatutEvaluation.PLANIFIEE) {
      await this.evaluations.update(evaluation.id, {
        statut: StatutEvaluation.EN_COURS,
      });
    }

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
  // l'enseignant, et à recaler le minuteur de l'étudiant.
  // ---------------------------------------------------------------------------
  async ping(participation: Participation) {
    await this.verifierPeutRepondre(participation);
    await this.marquerActivite(participation);
    return {
      ok: true,
      tempsRestantSecondes: this.tempsRestantSecondes(participation),
    };
  }

  // ---------------------------------------------------------------------------
  // TERMINER : l'étudiant a fini.
  // (Prototype : à l'étape 7, il faudra aussi fournir le CODE DE SORTIE.)
  // ---------------------------------------------------------------------------
  async terminer(participation: Participation) {
    if (participation.statut === StatutParticipation.EN_COURS) {
      await this.cloturer(participation);
    }
    return { ok: true };
  }

  // ===========================================================================
  // Fonctions internes (non exposées)
  // ===========================================================================

  // Heure de fin = le plus tôt entre « début + durée + temps supplémentaire »
  // et la fin de la plage horaire de l'évaluation.
  private calculerFinPrevue(
    debut: Date,
    dureeMinutes: number,
    tempsSupplementaireSecondes: number,
    finPlage: Date,
  ): Date {
    const finParDuree =
      debut.getTime() +
      dureeMinutes * 60_000 +
      tempsSupplementaireSecondes * 1000;
    return new Date(Math.min(finParDuree, finPlage.getTime()));
  }

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
  }

  // Vérifie que l'étudiant peut encore répondre ; sinon refuse avec un « code »
  // que l'interface lit pour afficher le bon message de fin.
  private async verifierPeutRepondre(
    participation: Participation,
  ): Promise<void> {
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
    const questions = await this.questions.find({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'ASC' },
    });
    const reponses = await this.reponses.findBy({
      participationId: participation.id,
    });

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
      // jamais recevoir les bonnes réponses. (Le mélange des questions viendra plus tard.)
      questions: questions.map((q) => ({
        id: q.id,
        ordre: q.ordre,
        type: q.type,
        enonce: q.enonce,
        points: q.points,
        langage: q.langage,
        options: q.options
          ? q.options.map((o) => ({ id: o.id, texte: o.texte }))
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

  // Enregistre le dernier signal de vie de l'étudiant.
  private async marquerActivite(participation: Participation): Promise<void> {
    await this.participations.update(participation.id, {
      derniereActiviteAt: new Date(),
    });
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