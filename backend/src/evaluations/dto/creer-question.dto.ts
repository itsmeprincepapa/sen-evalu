import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TypeQuestion } from '../../database/enums';
import { LANGAGES } from '../langages';

// Une proposition d'un QCM, telle que l'enseignant l'envoie.
// Pas d'identifiant ici : le serveur numérote lui-même les propositions (a, b, c...).
export class OptionQcmDto {
  @IsString()
  @Length(1, 500)
  texte!: string;

  @IsBoolean()
  correcte!: boolean;
}

// Données pour créer une question.
export class CreerQuestionDto {
  @IsEnum(TypeQuestion)
  type!: TypeQuestion;

  @IsString()
  @Length(1, 10000)
  enonce!: string;

  // Points de la question : supérieurs à 0, deux décimales au plus (ex. 1.5).
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  points!: number;

  // Seulement pour une question de code : le langage choisi dans la liste.
  @IsOptional()
  @IsIn(LANGAGES)
  langage?: string;

  // Seulement pour un QCM : 10 propositions au plus.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OptionQcmDto)
  options?: OptionQcmDto[];
}