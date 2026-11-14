import { IsBoolean } from 'class-validator';

// Donnée pour retirer (false) ou rétablir (true) l'accès d'un enseignant.
export class ChangerAccesDto {
  @IsBoolean()
  actif!: boolean;
}