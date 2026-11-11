import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { Etablissement } from './etablissement.entity';
import { Etudiant } from './etudiant.entity';

// Une classe réutilisable d'une évaluation à l'autre (exemple : « L2 Info »).
// Deux classes du même établissement ne peuvent pas porter le même nom.
@Entity('classes')
@Index(['etablissementId', 'nom'], { unique: true })
export class Classe extends BaseEntite {
  @Column('uuid')
  etablissementId!: string;

  @ManyToOne(() => Etablissement)
  @JoinColumn({ name: 'etablissementId' })
  etablissement!: Relation<Etablissement>;

  @Column({ length: 100 })
  nom!: string;

  // Les étudiants de la classe : un étudiant peut être dans plusieurs classes
  // et une classe contient plusieurs étudiants.
  // « JoinTable » crée automatiquement la table de liaison « classes_etudiants »
  // (une ligne par couple classe / étudiant).
  @ManyToMany(() => Etudiant)
  @JoinTable({ name: 'classes_etudiants' })
  etudiants!: Etudiant[];
}