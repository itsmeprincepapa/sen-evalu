import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

// Les demandes d'inscription que l'enseignant désigne : une liste précise, ou « toutes ».
export class ChoixInscriptionsDto {
  // Les identifiants des demandes choisies (500 au maximum).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids?: string[];

  // Vrai : toutes les demandes EN ATTENTE de l'évaluation.
  @IsOptional()
  @IsBoolean()
  tous?: boolean;
}