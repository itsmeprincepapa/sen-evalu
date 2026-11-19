import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Une date doit se terminer par « Z » (UTC) ou par un décalage (+01:00) :
// ainsi le serveur ne devine jamais le fuseau horaire.
export const FUSEAU_OBLIGATOIRE = /(Z|[+-]\d{2}:\d{2})$/;

// Données pour créer le BROUILLON d'une évaluation.
// Les options (plein écran, mélange...) se règlent ensuite avec la modification.
export class CreerEvaluationDto {
  @IsString()
  @Length(1, 200)
  titre!: string;

  // Début et fin de la plage horaire, en UTC (ex. « 2026-12-01T09:00:00Z »).
  @IsDateString()
  @Matches(FUSEAU_OBLIGATOIRE, { message: 'La date doit indiquer le fuseau (Z).' })
  debut!: string;

  @IsDateString()
  @Matches(FUSEAU_OBLIGATOIRE, { message: 'La date doit indiquer le fuseau (Z).' })
  fin!: string;

  // Durée accordée à chaque étudiant, en minutes (de 1 minute à 24 heures).
  @IsInt()
  @Min(1)
  @Max(1440)
  dureeMinutes!: number;

  // Classes rattachées (facultatif à la création : il en faudra une pour planifier).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  classeIds?: string[];
}