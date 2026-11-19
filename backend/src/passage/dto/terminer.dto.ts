import { IsString, Length } from 'class-validator';

// Données envoyées par l'étudiant pour quitter l'évaluation.
export class TerminerDto {
  // Le code de sortie donné par l'enseignant.
  @IsString()
  @Length(1, 20)
  codeSortie!: string;
}