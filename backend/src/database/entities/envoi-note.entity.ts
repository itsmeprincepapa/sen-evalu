import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntite } from '../base.entity';
import { StatutEnvoi } from '../enums';
import { Participation } from './participation.entity';

// Trace de l'envoi de la note d'un étudiant par e-mail.
// Elle permet à l'enseignant de savoir à qui l'e-mail n'est pas parti.
// La date de l'envoi est la date de création de la ligne (champ « creeLe »).
@Entity('envois_notes')
export class EnvoiNote extends BaseEntite {
  @Column('uuid')
  participationId!: string;

  @ManyToOne(() => Participation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participationId' })
  participation!: Relation<Participation>;

  @Column({ type: 'enum', enum: StatutEnvoi })
  statut!: StatutEnvoi;

  // Message d'erreur en cas d'échec.
  @Column({ type: 'text', nullable: true })
  erreur!: string | null;
}