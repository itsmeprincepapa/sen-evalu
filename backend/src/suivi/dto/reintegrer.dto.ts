import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Réintégration d'un étudiant exclu. Le temps supplémentaire est facultatif :
// le chronomètre a continué pendant l'exclusion.
export class ReintegrerDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  minutes?: number;
}