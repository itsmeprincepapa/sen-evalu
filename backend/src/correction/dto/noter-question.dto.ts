import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// La note (et le commentaire) donnés par l'enseignant à une réponse écrite.
export class NoterQuestionDto {
  // De 0 jusqu'au nombre de points de la question (le service vérifie le maximum).
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  note!: number;

  // Facultatif. Un commentaire vide ou « null » efface le commentaire existant.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string | null;
}