import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
import { OptionQcmDto } from './creer-question.dto';

// Modification d'une question : tous les champs sont facultatifs.
// Si le TYPE change, les propositions et le langage repartent de zéro :
// il faut alors les renvoyer s'ils sont nécessaires au nouveau type.
export class ModifierQuestionDto {
  @IsOptional()
  @IsEnum(TypeQuestion)
  type?: TypeQuestion;

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  enonce?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  points?: number;

  // « null » efface le langage.
  @IsOptional()
  @IsIn(LANGAGES)
  langage?: string | null;

  // Liste COMPLÈTE des propositions (elle remplace l'ancienne). « null » les efface.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OptionQcmDto)
  options?: OptionQcmDto[] | null;
}