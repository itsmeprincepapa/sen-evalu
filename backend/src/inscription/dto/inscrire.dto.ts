import { IsEmail, IsString, IsUUID, Length } from 'class-validator';

// Données envoyées par l'étudiant pour demander son inscription.
export class InscrireDto {
  @IsString()
  @Length(1, 100)
  nom!: string;

  @IsString()
  @Length(1, 100)
  prenom!: string;

  @IsEmail()
  @Length(3, 255)
  email!: string;

  // La classe choisie dans la liste proposée (elle doit être rattachée à l'évaluation).
  @IsUUID()
  classeId!: string;
}