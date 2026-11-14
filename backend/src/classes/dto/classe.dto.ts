import { IsString, Length } from 'class-validator';

// Données pour créer ou renommer une classe.
export class ClasseDto {
  @IsString()
  @Length(1, 100)
  nom!: string;
}