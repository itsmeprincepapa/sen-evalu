import { IsEmail, IsString, Length } from 'class-validator';

// Données envoyées par l'étudiant pour entrer dans l'évaluation.
// Chaque décorateur (@...) est une règle vérifiée AVANT que le code du service ne s'exécute.
export class EntrerDto {
  // Le lien aléatoire de l'évaluation (16 caractères dans nos tests).
  @IsString()
  @Length(1, 40)
  lien!: string;

  @IsEmail()
  @Length(3, 255)
  email!: string;

  // Le code d'accès donné à voix haute par l'enseignant.
  @IsString()
  @Length(1, 20)
  codeAcces!: string;
}