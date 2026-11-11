import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Classe de base : toutes nos tables héritent de ces trois colonnes.
// Le « ! » après un nom dit à TypeScript : « cette valeur sera remplie
// par la base de données, ne te plains pas ».
export abstract class BaseEntite {
  // Identifiant en UUID (texte aléatoire) plutôt qu'en numéro :
  // impossible à deviner dans une adresse web.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Date de création, remplie automatiquement.
  @CreateDateColumn()
  creeLe!: Date;

  // Date de dernière modification, mise à jour automatiquement.
  @UpdateDateColumn()
  modifieLe!: Date;
}