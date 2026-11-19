import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { FUSEAU_OBLIGATOIRE } from './creer-evaluation.dto';

// Modification d'une évaluation : TOUS les champs sont facultatifs,
// on n'envoie que ce qui change.
export class ModifierEvaluationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  titre?: string;

  @IsOptional()
  @IsDateString()
  @Matches(FUSEAU_OBLIGATOIRE, { message: 'La date doit indiquer le fuseau (Z).' })
  debut?: string;

  @IsOptional()
  @IsDateString()
  @Matches(FUSEAU_OBLIGATOIRE, { message: 'La date doit indiquer le fuseau (Z).' })
  fin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  dureeMinutes?: number;

  // Liste COMPLÈTE des classes voulues (elle remplace l'ancienne).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  classeIds?: string[];

  // --- Inscriptions : modifiables aussi pendant l'évaluation ---
  @IsOptional()
  @IsBoolean()
  inscriptionsOuvertes?: boolean;

  // Date de fermeture des inscriptions. « null » = pas de date de fermeture.
  // (@IsOptional accepte null : le service le traite comme « effacer la date ».)
  @IsOptional()
  @IsDateString()
  @Matches(FUSEAU_OBLIGATOIRE, { message: 'La date doit indiquer le fuseau (Z).' })
  inscriptionsFermeLe?: string | null;

  // --- Options (brouillon ou planifiée seulement) ---
  @IsOptional()
  @IsBoolean()
  pleinEcranObligatoire?: boolean;

  @IsOptional()
  @IsBoolean()
  detecterChangementOnglet?: boolean;

  @IsOptional()
  @IsBoolean()
  melangerQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  navigationLibre?: boolean;

  @IsOptional()
  @IsBoolean()
  retourEnArriere?: boolean;

  // Tolérance de coupure : de 0 à 10 minutes (en secondes).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  toleranceCoupureSecondes?: number;

  // Nombre d'incidents graves qui déclenche l'exclusion.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  seuilIncidentsGraves?: number;
}