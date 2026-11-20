  import { IsIn } from 'class-validator';
import { TypeIncident } from '../../database/enums';

// Données envoyées par l'interface quand elle détecte un comportement suspect.
// Seuls ces deux types viennent du navigateur ; les coupures, reconnexions, exclusions
// et réintégrations sont enregistrées par le serveur lui-même.
export class SignalerIncidentDto {
  @IsIn([TypeIncident.SORTIE_PLEIN_ECRAN, TypeIncident.CHANGEMENT_ONGLET])
  type!: TypeIncident;
}