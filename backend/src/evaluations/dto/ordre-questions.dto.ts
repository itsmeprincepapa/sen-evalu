import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Le nouvel ordre des questions : la liste de TOUS leurs identifiants, dans l'ordre voulu.
export class OrdreQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids!: string[];
}