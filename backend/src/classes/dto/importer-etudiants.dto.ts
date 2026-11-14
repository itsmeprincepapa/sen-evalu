import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

// Données pour importer une liste collée.
export class ImporterEtudiantsDto {
  // Le texte collé : une ligne par étudiant (nom, prénom, e-mail).
  @IsString()
  @Length(1, 100_000)
  texte!: string;

  // Faux ou absent : le serveur ANALYSE seulement et renvoie un aperçu, sans rien enregistrer.
  // Vrai : le serveur enregistre les lignes valides.
  @IsOptional()
  @IsBoolean()
  confirmer?: boolean;
}