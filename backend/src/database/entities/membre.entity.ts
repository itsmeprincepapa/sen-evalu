import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { RoleMembre } from '../enums';
import { Etablissement } from './etablissement.entity';
import { Utilisateur } from './utilisateur.entity';

// Rattachement d'un utilisateur à UN établissement avec UN rôle.
// Un enseignant qui intervient dans deux écoles a donc deux lignes « Membre ».
// L'index unique interdit d'avoir deux fois le même utilisateur
// dans le même établissement.
@Entity('membres')
@Index(['utilisateurId', 'etablissementId'], { unique: true })
export class Membre extends BaseEntite {
  // Colonne qui stocke l'identifiant de l'utilisateur (clé étrangère).
  @Column('uuid')
  utilisateurId!: string;

  // Relation : permet d'écrire « membre.utilisateur » pour obtenir la personne.
  // onDelete CASCADE : si l'utilisateur est supprimé, ses rattachements aussi.
  // « Relation<...> » évite des erreurs quand deux fichiers s'importent l'un l'autre.
  @ManyToOne(() => Utilisateur, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'utilisateurId' })
  utilisateur!: Relation<Utilisateur>;

  @Column('uuid')
  etablissementId!: string;

  // Pas de CASCADE ici : un établissement ne se supprime jamais, il se désactive.
  @ManyToOne(() => Etablissement)
  @JoinColumn({ name: 'etablissementId' })
  etablissement!: Relation<Etablissement>;

  @Column({ type: 'enum', enum: RoleMembre })
  role!: RoleMembre;
}