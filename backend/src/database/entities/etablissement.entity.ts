import { Column, Entity } from 'typeorm';
import { BaseEntite } from '../base.entity';
import { StatutEtablissement } from '../enums';

// Une école, un institut ou une université : un espace séparé des autres.
// « @Entity('etablissements') » donne le nom de la table dans MySQL.
@Entity('etablissements')
export class Etablissement extends BaseEntite {
  @Column({ length: 150 })
  nom!: string;

  // « nullable » : la ville est facultative (la valeur peut être vide).
  @Column({ type: 'varchar', length: 100, nullable: true })
  ville!: string | null;

  // Interrupteur actif / inactif, modifié à la main par le super-administrateur.
  // On ne supprime jamais un établissement : on le désactive.
  @Column({
    type: 'enum',
    enum: StatutEtablissement,
    default: StatutEtablissement.ACTIF,
  })
  statut!: StatutEtablissement;
}