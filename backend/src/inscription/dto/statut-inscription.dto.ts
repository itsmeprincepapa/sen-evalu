import { IsEmail, Length } from 'class-validator';

// Donnée envoyée pour savoir où en est une inscription.
export class StatutInscriptionDto {
  @IsEmail()
  @Length(3, 255)
  email!: string;
}