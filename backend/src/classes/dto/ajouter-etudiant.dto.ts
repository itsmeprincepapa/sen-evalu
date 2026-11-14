import { IsEmail, IsString, Length } from 'class-validator';

// Données pour ajouter UN étudiant à une classe.
export class AjouterEtudiantDto {
  @IsString()
  @Length(1, 100)
  nom!: string;

  @IsString()
  @Length(1, 100)
  prenom!: string;

  @IsEmail()
  @Length(3, 255)
  email!: string;
}