import { Participation } from '../database/entities/participation.entity';
import { StatutParticipation } from '../database/enums';

// Ce que l'enseignant voit pour chaque étudiant.
export type EtatConnexion =
  | 'pas_entre' // validé, mais n'a pas encore saisi le code d'accès
  | 'connecte' // un signal est arrivé récemment
  | 'coupe' // en cours, mais plus de signal depuis plus que la tolérance
  | 'exclu'
  | 'termine';

// L'interface envoie un signal au moins toutes les 10 secondes : en dessous de 25 secondes
// de silence, l'étudiant est toujours « connecté », quelle que soit la tolérance réglée.
const SILENCE_MINIMAL_SECONDES = 25;

// Calcule l'état de connexion d'un étudiant (« maintenant » est en millisecondes).
export function etatConnexion(
  participation: Participation,
  toleranceCoupureSecondes: number,
  maintenant: number,
): EtatConnexion {
  switch (participation.statut) {
    case StatutParticipation.VALIDE:
      return 'pas_entre';
    case StatutParticipation.EXCLU:
      return 'exclu';
    case StatutParticipation.TERMINE:
      return 'termine';
    default: {
      // En cours : on regarde depuis quand le dernier signal est arrivé.
      const dernier = participation.derniereActiviteAt?.getTime() ?? 0;
      const silenceMax =
        Math.max(toleranceCoupureSecondes, SILENCE_MINIMAL_SECONDES) * 1000;
      return maintenant - dernier > silenceMax ? 'coupe' : 'connecte';
    }
  }
}