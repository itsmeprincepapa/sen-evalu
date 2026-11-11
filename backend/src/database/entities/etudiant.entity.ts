import { Column, Entity, Index, JoinColumn, ManyToOne,type Relation } from 'typeorm';
import { BaseEntite } from '../base.entity';
import { Etablissement } from './etablissement.entity';

// Un étudiant n'a PAS de compte : il existe seulement dans les listes
// de son établissement. Il est enregistré lors de sa première validation
// par un enseignant, puis retrouvé aux évaluations suivantes.
// L'index unique : une même adresse e-mail ne peut apparaître qu'une fois
// par établissement.
@Entity('etudiants')
@Index(['etablissementId', 'email'], { unique: true })
export class Etudiant extends BaseEntite {
  @Column('uuid')
  etablissementId!: string;

  @ManyToOne(() => Etablissement)
  @JoinColumn({ name: 'etablissementId' })
  etablissement!: Relation<Etablissement>;

  @Column({ length: 100 })
  nom!: string;

  @Column({ length: 100 })
  prenom!: string;

  // C'est à cette adresse que la note sera envoyée.
  @Column({ length: 255 })
  email!: string;
}