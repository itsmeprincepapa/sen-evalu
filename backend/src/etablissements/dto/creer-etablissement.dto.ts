import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

// Données pour créer un établissement.
export class CreerEtablissementDto {
  @IsString()
  @Length(2, 150)
  nom!: string;

  // La ville est facultative.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;
}