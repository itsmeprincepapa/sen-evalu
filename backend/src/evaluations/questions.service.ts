import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Membre } from '../database/entities/membre.entity';
import { OptionQcm, Question } from '../database/entities/question.entity';
import { StatutEvaluation, TypeQuestion } from '../database/enums';
import { OptionQcmDto, CreerQuestionDto } from './dto/creer-question.dto';
import { ModifierQuestionDto } from './dto/modifier-question.dto';

// Les questions d'une évaluation, gérées par l'enseignant propriétaire.
@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
  ) {}

  // ---------------------------------------------------------------------------
  // LISTER les questions dans l'ordre, avec le total des points.
  // L'enseignant voit les bonnes réponses (« correcte ») : c'est SON évaluation.
  // ---------------------------------------------------------------------------
  async lister(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    const liste = await this.questions.find({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'ASC', creeLe: 'ASC' },
    });
    const total = liste.reduce((somme, q) => somme + q.points, 0);
    return {
      totalPoints: Math.round(total * 100) / 100,
      questions: liste.map((q) => this.vue(q)),
    };
  }

  // ---------------------------------------------------------------------------
  // CRÉER une question : elle se place à la fin.
  // ---------------------------------------------------------------------------
  async creer(membre: Membre, evaluationId: string, dto: CreerQuestionDto) {
    const evaluation = await this.evaluationModifiable(membre, evaluationId);

    const enonce = dto.enonce.trim();
    if (enonce === '') {
      throw new BadRequestException('L’énoncé ne peut pas être vide.');
    }
    const options = this.versOptions(dto.options);
    const langage = dto.langage ?? null;
    this.verifierCoherence(dto.type, langage, options);

    // La nouvelle question prend le numéro qui suit la dernière.
    const derniere = await this.questions.findOne({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'DESC' },
    });

    const question = await this.questions.save(
      this.questions.create({
        evaluationId: evaluation.id,
        ordre: (derniere?.ordre ?? 0) + 1,
        type: dto.type,
        enonce,
        points: dto.points,
        langage,
        options,
      }),
    );
    return this.vue(question);
  }

  // ---------------------------------------------------------------------------
  // MODIFIER une question. On fusionne l'ancien et le nouveau, puis on contrôle
  // l'ensemble : une question ne peut jamais devenir incohérente.
  // ---------------------------------------------------------------------------
  async modifier(
    membre: Membre,
    evaluationId: string,
    questionId: string,
    dto: ModifierQuestionDto,
  ) {
    // Ces champs sont obligatoires : on refuse de les vider.
    if (dto.type === null || dto.enonce === null || dto.points === null) {
      throw new BadRequestException('Ce champ ne peut pas être vide.');
    }

    const evaluation = await this.evaluationModifiable(membre, evaluationId);
    const question = await this.questions.findOneBy({
      id: questionId,
      evaluationId: evaluation.id,
    });
    if (!question) throw new NotFoundException('Question introuvable.');

    const type = dto.type ?? question.type;
    const typeChange = type !== question.type;

    // Si le type change, les propositions et le langage de l'ancien type ne valent plus :
    // ils ne peuvent venir que de la requête.
    let options = typeChange ? null : question.options;
    let langage = typeChange ? null : question.langage;
    if (dto.options !== undefined) options = this.versOptions(dto.options);
    if (dto.langage !== undefined) langage = dto.langage;

    this.verifierCoherence(type, langage, options);

    if (dto.enonce !== undefined) {
      const enonce = dto.enonce.trim();
      if (enonce === '') {
        throw new BadRequestException('L’énoncé ne peut pas être vide.');
      }
      question.enonce = enonce;
    }
    if (dto.points !== undefined) question.points = dto.points;
    question.type = type;
    question.langage = langage;
    question.options = options;

    await this.questions.save(question);
    return this.vue(question);
  }

  // ---------------------------------------------------------------------------
  // SUPPRIMER une question, puis renuméroter les autres (1, 2, 3... sans trou).
  // ---------------------------------------------------------------------------
  async supprimer(membre: Membre, evaluationId: string, questionId: string) {
    const evaluation = await this.evaluationModifiable(membre, evaluationId);
    const question = await this.questions.findOneBy({
      id: questionId,
      evaluationId: evaluation.id,
    });
    if (!question) throw new NotFoundException('Question introuvable.');

    // Tout se fait en UNE opération : la suppression et la renumérotation réussissent
    // ensemble, ou rien n'est changé.
    await this.questions.manager.transaction(async (gestionnaire) => {
      await gestionnaire.delete(Question, question.id);
      const restantes = await gestionnaire.find(Question, {
        where: { evaluationId: evaluation.id },
        order: { ordre: 'ASC', creeLe: 'ASC' },
      });
      for (let i = 0; i < restantes.length; i++) {
        if (restantes[i].ordre !== i + 1) {
          await gestionnaire.update(Question, restantes[i].id, { ordre: i + 1 });
        }
      }
    });
    return { supprimee: true };
  }

  // ---------------------------------------------------------------------------
  // RÉORDONNER : l'enseignant envoie la liste COMPLÈTE des identifiants dans le
  // nouvel ordre. Chaque question doit y figurer une fois, ni plus ni moins.
  // ---------------------------------------------------------------------------
  async reordonner(membre: Membre, evaluationId: string, ids: string[]) {
    const evaluation = await this.evaluationModifiable(membre, evaluationId);
    const existantes = await this.questions.find({
      where: { evaluationId: evaluation.id },
    });
    const idsExistants = new Set(existantes.map((q) => q.id));

    const complet =
      new Set(ids).size === ids.length &&
      ids.length === idsExistants.size &&
      ids.every((id) => idsExistants.has(id));
    if (!complet) {
      throw new BadRequestException(
        'La liste doit contenir chaque question de l’évaluation, une seule fois.',
      );
    }

    await this.questions.manager.transaction(async (gestionnaire) => {
      for (let i = 0; i < ids.length; i++) {
        await gestionnaire.update(Question, ids[i], { ordre: i + 1 });
      }
    });
    return this.lister(membre, evaluationId);
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

  // Idem, mais l'évaluation doit encore être en brouillon ou planifiée.
  private async evaluationModifiable(
    membre: Membre,
    evaluationId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    if (
      evaluation.statut !== StatutEvaluation.BROUILLON &&
      evaluation.statut !== StatutEvaluation.PLANIFIEE
    ) {
      throw new ForbiddenException(
        'Les questions ne peuvent plus être modifiées une fois l’évaluation commencée.',
      );
    }
    return evaluation;
  }

  // Transforme les propositions reçues en propositions numérotées : a, b, c...
  // (Aucun étudiant n'a encore répondu à une évaluation en brouillon ou planifiée :
  // changer les identifiants ne casse donc aucune réponse.)
  private versOptions(
    options: OptionQcmDto[] | null | undefined,
  ): OptionQcm[] | null {
    if (!options || options.length === 0) return null;
    return options.map((o, i) => ({
      id: String.fromCharCode(97 + i), // 97 = « a »
      texte: o.texte.trim(),
      correcte: o.correcte,
    }));
  }

  // Les règles de chaque type de question.
  private verifierCoherence(
    type: TypeQuestion,
    langage: string | null,
    options: OptionQcm[] | null,
  ): void {
    const estQcm =
      type === TypeQuestion.QCM_UNIQUE || type === TypeQuestion.QCM_MULTIPLE;

    if (estQcm) {
      if (langage !== null) {
        throw new BadRequestException('Un QCM n’a pas de langage.');
      }
      if (!options || options.length < 2) {
        throw new BadRequestException('Un QCM demande au moins 2 propositions.');
      }
      if (options.some((o) => o.texte === '')) {
        throw new BadRequestException('Une proposition ne peut pas être vide.');
      }
      const correctes = options.filter((o) => o.correcte).length;
      if (type === TypeQuestion.QCM_UNIQUE && correctes !== 1) {
        throw new BadRequestException(
          'Un QCM à une seule réponse demande exactement une bonne réponse.',
        );
      }
      if (type === TypeQuestion.QCM_MULTIPLE && correctes < 1) {
        throw new BadRequestException('Cochez au moins une bonne réponse.');
      }
      return;
    }

    // Réponse courte, question ouverte, code : jamais de propositions.
    if (options !== null) {
      throw new BadRequestException(
        'Ce type de question n’a pas de propositions.',
      );
    }
    if (type === TypeQuestion.CODE) {
      if (!langage) {
        throw new BadRequestException(
          'Choisissez le langage de la question de code.',
        );
      }
    } else if (langage !== null) {
      throw new BadRequestException('Seule une question de code a un langage.');
    }
  }

  // Ce que l'enseignant reçoit. Les bonnes réponses y sont : cette vue ne sert
  // JAMAIS à l'étudiant (voir passage.service.ts, qui enlève « correcte »).
  private vue(q: Question) {
    return {
      id: q.id,
      ordre: q.ordre,
      type: q.type,
      enonce: q.enonce,
      points: q.points,
      langage: q.langage,
      options: q.options,
    };
  }
}