import { IsEmail, IsString, Length } from 'class-validator';

// Données pour nommer l'administrateur d'un établissement.
export class AjouterAdminDto {
  // L'adresse du compte GOOGLE de cette personne : c'est avec elle qu'elle se connectera.
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