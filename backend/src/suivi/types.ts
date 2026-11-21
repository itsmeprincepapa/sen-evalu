import type { Incident } from '../database/entities/incident.entity';
import type { Participation } from '../database/entities/participation.entity';
import type {
  GraviteIncident,
  StatutParticipation,
  TypeIncident,
} from '../database/enums';
import type { EtatConnexion } from './etat-connexion';

// Une ligne du tableau de suivi : la situation d'UN étudiant.
export interface LigneEtudiant {
  participationId: string;
  nom: string;
  prenom: string;
  email: string;
  statut: StatutParticipation;
  connexion: EtatConnexion;
  nbIncidentsGraves: number;
  tempsSupplementaireSecondes: number;
  tempsRestantSecondes: number | null;
  questionEnCours: number | null; // numéro de la question affichée (à partir de 1)
  derniereActiviteAt: Date | null;
}

// Une ligne du journal des incidents.
export interface LigneJournal {
  id: string;
  heure: Date;
  type: TypeIncident;
  gravite: GraviteIncident;
  details: string | null;
  participationId: string;
  nom: string;
  prenom: string;
}

// Transforme un incident en ligne de journal (avec le nom de l'étudiant).
export function versLigneJournal(
  incident: Incident,
  participation: Participation,
): LigneJournal {
  return {
    id: incident.id,
    heure: incident.creeLe,
    type: incident.type,
    gravite: incident.gravite,
    details: incident.details,
    participationId: incident.participationId,
    nom: participation.nom,
    prenom: participation.prenom,
  };
}

// Ce qui fait qu'une ligne a « changé » aux yeux de l'enseignant. Le temps restant n'en
// fait pas partie : il diminue sans cesse, l'écran le décompte tout seul.
export function cleChangement(ligne: LigneEtudiant): string {
  return [
    ligne.statut,
    ligne.connexion,
    ligne.nbIncidentsGraves,
    ligne.questionEnCours ?? '',
    ligne.tempsSupplementaireSecondes,
  ].join('|');
}