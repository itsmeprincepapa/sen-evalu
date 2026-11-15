import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

// Ce que l'enseignant peut corriger dans une demande avant de la valider.
// Chaque champ est facultatif : seuls ceux qui sont envoyés changent.
export class CorrigerInscriptionDto {
  @IsOptional()
  @IsEmail()
  @Length(3, 255)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nom?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  prenom?: string;
}