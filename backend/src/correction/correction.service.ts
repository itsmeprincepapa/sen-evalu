import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Membre } from '../database/entities/membre.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { Reponse } from '../database/entities/reponse.entity';
import {
  StatutEvaluation,
  StatutParticipation,
  TypeQuestion,
} from '../database/enums';
import { NoterQuestionDto } from './dto/noter-question.dto';

// Arrondit à deux décimales (les notes ont deux décimales au plus).
const arrondir = (n: number) => Math.round(n * 100) / 100;

const estQcm = (question: Question) =>
  question.type === TypeQuestion.QCM_UNIQUE ||
  question.type === TypeQuestion.QCM_MULTIPLE;

// Une réponse est « vide » si l'étudiant n'a rien écrit ni coché.
function estVide(contenu: Reponse['contenu']): boolean {
  if (contenu === null) return true;
  if (Array.isArray(contenu)) return contenu.length === 0;
  return contenu.trim() === '';
}

// NOTE D'UN QCM : tout ou rien. Les points sont donnés seulement si l'étudiant a coché
// TOUTES les bonnes propositions et AUCUNE mauvaise (même règle pour un QCM à une seule
// bonne réponse ou à plusieurs).
function noteQcm(question: Question, contenu: Reponse['contenu']): number {
  const bonnes = (question.options ?? [])
    .filter((o) => o.correcte)
    .map((o) => o.id)
    .sort();
  const cochees = Array.isArray(contenu) ? [...new Set(contenu)].sort() : [];
  const juste =
    bonnes.length === cochees.length && bonnes.every((id, i) => id === cochees[i]);
  return juste ? question.points : 0;
}

// Une ligne du tableau des résultats : une copie.
export interface LigneCopie {
  participationId: string;
  nom: string;
  prenom: string;
  email: string;
  statut: StatutParticipation; // « termine » ou « exclu »
  nbIncidentsGraves: number;
  noteQcm: number; // total des points des QCM (automatique)
  noteTotale: number; // QCM + notes saisies à la main
  nbACorriger: number; // questions écrites qui attendent encore une note
  corrigee: boolean; // plus rien à corriger dans cette copie
}

interface ResultatPreparation {
  questions: Question[];
  lignes: LigneCopie[];
  statutEvaluation: StatutEvaluation;
}

// La correction d'une évaluation par son enseignant.
@Injectable()
export class CorrectionService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
    @InjectRepository(Reponse)
    private readonly reponses: Repository<Reponse>,
  ) {}

  // Les préparations en cours : si l'enseignant ouvre deux fois la page en même temps,
  // le travail n'est fait qu'une fois (sinon des lignes seraient créées en double).
  private readonly preparations = new Map<string, Promise<ResultatPreparation>>();

  // ---------------------------------------------------------------------------
  // ÉTAT DE LA CORRECTION : prépare les copies (notes des QCM, totaux), puis renvoie
  // le tableau des résultats et le compteur « N corrigées sur M ».
  // ---------------------------------------------------------------------------
  async etat(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationTerminee(membre, evaluationId);
    const { questions, lignes, statutEvaluation } =
      await this.preparer(evaluation);

    return {
      evaluation: {
        id: evaluation.id,
        titre: evaluation.titre,
        statut: statutEvaluation,
        totalPoints: arrondir(questions.reduce((somme, q) => somme + q.points, 0)),
        nombreQuestions: questions.length,
      },
      compteurs: this.compteurs(lignes),
      copies: lignes,
    };
  }

  // ---------------------------------------------------------------------------
  // UNE COPIE : toutes ses questions avec la réponse de l'étudiant, la bonne réponse des
  // QCM, la note et le commentaire de chaque question, et de quoi passer à la copie
  // précédente, suivante, ou à la prochaine copie à corriger.
  // ---------------------------------------------------------------------------
  async copie(membre: Membre, evaluationId: string, participationId: string) {
    const evaluation = await this.evaluationTerminee(membre, evaluationId);
    const { questions, lignes, statutEvaluation } =
      await this.preparer(evaluation);

    const index = lignes.findIndex((l) => l.participationId === participationId);
    if (index === -1) throw new NotFoundException('Copie introuvable.');

    const reponses = await this.reponses.findBy({ participationId });
    const parQuestion = new Map(reponses.map((r) => [r.questionId, r]));

    return {
      evaluation: {
        id: evaluation.id,
        titre: evaluation.titre,
        statut: statutEvaluation,
        totalPoints: arrondir(questions.reduce((somme, q) => somme + q.points, 0)),
      },
      copie: { ...lignes[index], numero: index + 1, total: lignes.length },
      precedente: index > 0 ? lignes[index - 1].participationId : null,
      suivante:
        index < lignes.length - 1 ? lignes[index + 1].participationId : null,
      prochaineACorriger: this.prochaineACorriger(lignes, index),
      questions: questions.map((q) =>
        this.versQuestionDeCopie(q, parQuestion.get(q.id)),
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // NOTER une réponse écrite (réponse courte, question ouverte, code) : une note de 0 au
  // nombre de points de la question, et un commentaire facultatif. Les totaux de la copie,
  // le compteur et l'état de l'évaluation sont recalculés.
  // ---------------------------------------------------------------------------
  async noter(
    membre: Membre,
    evaluationId: string,
    participationId: string,
    questionId: string,
    dto: NoterQuestionDto,
  ) {
    const evaluation = await this.evaluationTerminee(membre, evaluationId);

    const question = await this.questions.findOneBy({
      id: questionId,
      evaluationId: evaluation.id,
    });
    if (!question) throw new NotFoundException('Question introuvable.');
    if (estQcm(question)) {
      throw new BadRequestException(
        'Les QCM sont notés automatiquement : leur note ne se modifie pas.',
      );
    }
    if (dto.note > question.points) {
      throw new BadRequestException(
        `La note ne peut pas dépasser ${question.points} point${question.points > 1 ? 's' : ''}.`,
      );
    }

    const copie = await this.participations.findOneBy({
      id: participationId,
      evaluationId: evaluation.id,
      statut: In([StatutParticipation.TERMINE, StatutParticipation.EXCLU]),
    });
    if (!copie) throw new NotFoundException('Copie introuvable.');

    // La ligne de réponse existe normalement déjà (créée à la préparation). Sinon, on lance
    // la préparation, qui crée les lignes manquantes.
    let reponse = await this.reponses.findOneBy({ participationId, questionId });
    if (!reponse) {
      await this.preparer(evaluation);
      reponse = await this.reponses.findOneByOrFail({ participationId, questionId });
    }

    reponse.note = arrondir(dto.note);
    const commentaire = dto.commentaire?.trim();
    reponse.commentaire = commentaire ? commentaire : null;
    await this.reponses.save(reponse);

    // On recalcule les totaux et l'état de l'évaluation (« Corrigée » si tout est corrigé).
    const { lignes, statutEvaluation } = await this.preparer(evaluation);
    const index = lignes.findIndex((l) => l.participationId === participationId);
    const ligne = lignes[index];

    return {
      note: reponse.note,
      commentaire: reponse.commentaire,
      copie: {
        noteTotale: ligne.noteTotale,
        nbACorriger: ligne.nbACorriger,
        corrigee: ligne.corrigee,
      },
      compteurs: this.compteurs(lignes),
      statutEvaluation,
      prochaineACorriger: this.prochaineACorriger(lignes, index),
    };
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Le compteur « N corrigées sur M ».
  private compteurs(lignes: LigneCopie[]) {
    return {
      corrigees: lignes.filter((l) => l.corrigee).length,
      total: lignes.length,
    };
  }

  // La prochaine copie à corriger après la copie « index » (on reprend au début à la fin
  // de la liste). « null » s'il n'y en a plus d'autre.
  private prochaineACorriger(lignes: LigneCopie[], index: number): string | null {
    for (let pas = 1; pas < lignes.length; pas++) {
      const ligne = lignes[(index + pas) % lignes.length];
      if (!ligne.corrigee) return ligne.participationId;
    }
    return null;
  }

  // Une question d'une copie, telle que l'enseignant la voit : avec la réponse de
  // l'étudiant, la bonne réponse des QCM (« correcte »), la note et le commentaire.
  private versQuestionDeCopie(question: Question, reponse: Reponse | undefined) {
    const contenu = reponse?.contenu ?? null;
    const qcm = estQcm(question);
    const cochees = Array.isArray(contenu) ? contenu : [];
    return {
      questionId: question.id,
      ordre: question.ordre,
      type: question.type,
      enonce: question.enonce,
      points: question.points,
      langage: question.langage,
      notation: qcm ? 'auto' : 'manuelle',
      options: qcm
        ? (question.options ?? []).map((o) => ({
            id: o.id,
            texte: o.texte,
            correcte: o.correcte,
            cochee: cochees.includes(o.id),
          }))
        : null,
      reponse: !qcm && typeof contenu === 'string' ? contenu : null,
      vide: estVide(contenu),
      note: reponse?.note ?? null,
      commentaire: reponse?.commentaire ?? null,
    };
  }

  // Retrouve l'évaluation SEULEMENT si elle appartient à CET enseignant, dans CET
  // établissement, ET si elle est terminée (on ne corrige pas une évaluation en cours).
  private async evaluationTerminee(
    membre: Membre,
    evaluationId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluations.findOneBy({
      id: evaluationId,
      etablissementId: membre.etablissementId,
      membreId: membre.id,
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable.');

    const terminee = [
      StatutEvaluation.TERMINEE,
      StatutEvaluation.CORRIGEE,
      StatutEvaluation.PUBLIEE,
    ].includes(evaluation.statut);
    if (!terminee) {
      throw new ConflictException(
        'L’évaluation n’est pas encore terminée : la correction commencera quand elle le sera.',
      );
    }
    return evaluation;
  }

  // Lance la préparation, ou rejoint celle qui est déjà en cours pour cette évaluation.
  private preparer(evaluation: Evaluation): Promise<ResultatPreparation> {
    const enCours = this.preparations.get(evaluation.id);
    if (enCours) return enCours;

    const travail = this.faire(evaluation).finally(() => {
      this.preparations.delete(evaluation.id);
    });
    this.preparations.set(evaluation.id, travail);
    return travail;
  }

  // LA PRÉPARATION. Elle peut être refaite autant de fois qu'on veut : elle ne change
  // que ce qui doit l'être.
  private async faire(evaluation: Evaluation): Promise<ResultatPreparation> {
    const questions = await this.questions.find({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'ASC' },
    });
    // Les copies : étudiants qui ont terminé, ou qui ont été exclus (copie corrigée telle quelle).
    const copies = await this.participations.find({
      where: {
        evaluationId: evaluation.id,
        statut: In([StatutParticipation.TERMINE, StatutParticipation.EXCLU]),
      },
      order: { nom: 'ASC', prenom: 'ASC' },
    });
    const reponses =
      copies.length === 0
        ? []
        : await this.reponses.find({
            where: { participationId: In(copies.map((c) => c.id)) },
          });

    // Les réponses rangées par copie, puis par question.
    const parCopie = new Map<string, Map<string, Reponse>>();
    for (const reponse of reponses) {
      const deLaCopie =
        parCopie.get(reponse.participationId) ?? new Map<string, Reponse>();
      deLaCopie.set(reponse.questionId, reponse);
      parCopie.set(reponse.participationId, deLaCopie);
    }

    const aEnregistrer: Reponse[] = [];
    const lignes: LigneCopie[] = [];

    for (const copie of copies) {
      const deLaCopie = parCopie.get(copie.id) ?? new Map<string, Reponse>();
      let total = 0;
      let totalQcm = 0;
      let nbACorriger = 0;

      for (const question of questions) {
        let reponse = deLaCopie.get(question.id);
        let modifiee = false;

        // Question sans aucune réponse enregistrée : on crée une ligne vide, pour que la
        // copie ait une ligne par question.
        if (!reponse) {
          reponse = this.reponses.create({
            participationId: copie.id,
            questionId: question.id,
            contenu: null,
            version: 0,
            note: null,
            commentaire: null,
          });
          modifiee = true;
        }

        if (estQcm(question)) {
          // QCM : note automatique, toujours recalculée (tout ou rien).
          const note = noteQcm(question, reponse.contenu);
          if (reponse.note !== note) {
            reponse.note = note;
            modifiee = true;
          }
          totalQcm += note;
        } else if (reponse.note === null && estVide(reponse.contenu)) {
          // Réponse rédigée ou code laissé vide : 0 d'office, rien à corriger.
          reponse.note = 0;
          modifiee = true;
        }

        if (modifiee) aEnregistrer.push(reponse);
        if (reponse.note === null) nbACorriger += 1;
        else total += reponse.note;
      }

      const noteTotale = arrondir(total);
      const corrigee = nbACorriger === 0;
      if (copie.noteTotale !== noteTotale || copie.corrigee !== corrigee) {
        await this.participations.update(copie.id, { noteTotale, corrigee });
      }

      lignes.push({
        participationId: copie.id,
        nom: copie.nom,
        prenom: copie.prenom,
        email: copie.email,
        statut: copie.statut,
        nbIncidentsGraves: copie.nbIncidentsGraves,
        noteQcm: arrondir(totalQcm),
        noteTotale,
        nbACorriger,
        corrigee,
      });
    }

    if (aEnregistrer.length > 0) await this.reponses.save(aEnregistrer);

    // Toutes les copies sont corrigées : l'évaluation passe à « Corrigée ».
    let statutEvaluation = evaluation.statut;
    if (
      statutEvaluation === StatutEvaluation.TERMINEE &&
      lignes.length > 0 &&
      lignes.every((l) => l.corrigee)
    ) {
      await this.evaluations.update(evaluation.id, {
        statut: StatutEvaluation.CORRIGEE,
      });
      statutEvaluation = StatutEvaluation.CORRIGEE;
    }

    return { questions, lignes, statutEvaluation };
  }
}