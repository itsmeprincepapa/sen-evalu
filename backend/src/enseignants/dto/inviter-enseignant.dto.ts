import { IsEmail, IsString, Length } from 'class-validator';

// Données pour inviter un enseignant dans l'établissement.
export class InviterEnseignantDto {
  // L'adresse du compte GOOGLE de l'enseignant : c'est avec elle qu'il se connectera.
  @IsEmail()
  @Length(3, 255)
  email!: string;

  @IsString()
  @Length(1, 100)
  nom!: string;

  @IsString()
  @Length(1, 100)
  prenom!: string;
}