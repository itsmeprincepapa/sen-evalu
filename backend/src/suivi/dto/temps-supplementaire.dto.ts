import { IsInt, Max, Min } from 'class-validator';

// Le temps supplémentaire accordé à un étudiant, en minutes (de 1 à 120).
export class TempsSupplementaireDto {
  @IsInt()
  @Min(1)
  @Max(120)
  minutes!: number;
}