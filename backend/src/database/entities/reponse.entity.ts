import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
 type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { decimalEnNombre } from '../transformers';
import { Participation } from './participation.entity';
import { Question } from './question.entity';

// La réponse d'UN étudiant à UNE question.
// Il y en a au plus une par couple participation / question (index unique) :
// chaque sauvegarde automatique REMPLACE la précédente.
@Entity('reponses')
@Index(['participationId', 'questionId'], { unique: true })
export class Reponse extends BaseEntite {
  @Column('uuid')
  participationId!: string;

  @ManyToOne(() => Participation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participationId' })
  participation!: Relation<Participation>;

  @Column('uuid')
  questionId!: string;

  // Pas de CASCADE : on ne peut pas supprimer une question qui a déjà des réponses.
  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question!: Relation<Question>;

  // Le contenu dépend du type : un texte (réponse rédigée, code)
  // ou une liste d'identifiants de propositions cochées (QCM).
  @Column({ type: 'json', nullable: true })
  contenu!: string | string[] | null;

  // Numéro de version : une sauvegarde plus ancienne, arrivée en retard
  // après une coupure, n'écrase jamais une sauvegarde plus récente.
  @Column({ type: 'int', default: 0 })
  version!: number;

  // Note donnée à cette réponse (automatique pour un QCM, saisie par l'enseignant sinon).
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalEnNombre,
  })
  note!: number | null;

  @Column({ type: 'text', nullable: true })
  commentaire!: string | null;
}