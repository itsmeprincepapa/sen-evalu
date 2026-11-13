import { IsEnum } from 'class-validator';
import { StatutEtablissement } from '../../database/enums';

// Donnée pour l'interrupteur : « actif » ou « inactif ».
export class ChangerStatutDto {
  @IsEnum(StatutEtablissement)
  statut!: StatutEtablissement;
}