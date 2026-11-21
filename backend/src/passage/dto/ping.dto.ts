import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Données (facultatives) du signal « je suis toujours là ».
export class PingDto {
  // Le numéro de la question affichée à l'écran (à partir de 1) : le serveur le garde pour
  // l'afficher à l'enseignant dans le suivi en direct.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  question?: number;
}