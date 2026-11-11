import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { TypeQuestion } from '../enums';
import { decimalEnNombre } from '../transformers';
import { Evaluation } from './evaluation.entity';

// Une proposition de réponse d'un QCM.
// ATTENTION : « correcte » ne doit JAMAIS être envoyé au navigateur de l'étudiant.
export interface OptionQcm {
  id: string; // identifiant de la proposition (ex. « a », « b »)
  texte: string;
  correcte: boolean;
}

// Une question d'une évaluation.
@Entity('questions')
@Index(['evaluationId', 'ordre'])
export class Question extends BaseEntite {
  @Column('uuid')
  evaluationId!: string;

  // CASCADE : si l'évaluation (brouillon) est supprimée, ses questions aussi.
  @ManyToOne(() => Evaluation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation!: Relation<Evaluation>;

  // Position de la question dans l'évaluation (1, 2, 3...).
  @Column({ type: 'int' })
  ordre!: number;

  @Column({ type: 'enum', enum: TypeQuestion })
  type!: TypeQuestion;

  // Texte de la question : « text » permet un long énoncé.
  @Column({ type: 'text' })
  enonce!: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalEnNombre,
  })
  points!: number;

  // Pour une question de code : le langage choisi par l'enseignant (ex. « javascript »).
  @Column({ type: 'varchar', length: 30, nullable: true })
  langage!: string | null;

  // Pour un QCM : la liste des propositions, stockée au format JSON.
  @Column({ type: 'json', nullable: true })
  options!: OptionQcm[] | null;
}