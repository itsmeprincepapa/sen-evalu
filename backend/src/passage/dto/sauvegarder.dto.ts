import { IsDefined, IsInt, Min } from 'class-validator';

// Données envoyées à chaque sauvegarde automatique d'une réponse.
export class SauvegarderDto {
  // Un texte (réponse rédigée, code) ou une liste d'identifiants (QCM).
  // Le détail est vérifié dans le service, car cela dépend du type de la question.
  @IsDefined()
  contenu!: string | string[];

  // Numéro de version, qui augmente à chaque sauvegarde (1, 2, 3...).
  // Une version plus ancienne que celle déjà enregistrée est ignorée.
  @IsInt()
  @Min(1)
  version!: number;
}