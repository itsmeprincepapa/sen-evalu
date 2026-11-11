import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { GraviteIncident, TypeIncident } from '../enums';
import { Participation } from './participation.entity';

// Une ligne du journal d'une participation (sortie du plein écran, coupure, exclusion...).
// L'heure de l'incident est la date de création de la ligne (champ « creeLe »).
@Entity('incidents')
@Index(['participationId', 'creeLe'])
export class Incident extends BaseEntite {
  @Column('uuid')
  participationId!: string;

  @ManyToOne(() => Participation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participationId' })
  participation!: Relation<Participation>;

  @Column({ type: 'enum', enum: TypeIncident })
  type!: TypeIncident;

  @Column({ type: 'enum', enum: GraviteIncident })
  gravite!: GraviteIncident;

  // Détail facultatif (ex. durée de la coupure).
  @Column({ type: 'varchar', length: 255, nullable: true })
  details!: string | null;
}