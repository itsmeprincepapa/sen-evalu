import type {
  AccuseSauvegarde,
  Contenu,
  Entree,
  Etat,
  ResultatIncident,
} from '../types';
import { appeler } from './http';

// Les classes d'erreur vivent maintenant dans http.ts. On les re-exporte ici pour que
// les fichiers qui les importaient depuis « api/passage » continuent de fonctionner.
export { ErreurApi, ErreurReseau } from './http';

// --- Les actions du serveur pour le passage d'une évaluation ---

// Entrer avec l'e-mail et le code d'accès (démarre ou reprend l'évaluation).
export const entrer = (lien: string, email: string, codeAcces: string) =>
  appeler<Entree>('/passage/entrer', {
    methode: 'POST',
    corps: { lien, email, codeAcces },
  });

// Relire l'état (après un rechargement de la page).
export const lireEtat = (jeton: string) =>
  appeler<Etat>('/passage/etat', { methode: 'GET', jeton });

// Sauvegarder la réponse à UNE question.
export const sauvegarder = (
  jeton: string,
  questionId: string,
  contenu: Contenu,
  version: number,
) =>
  appeler<AccuseSauvegarde>(`/passage/reponses/${questionId}`, {
    methode: 'PUT',
    jeton,
    corps: { contenu, version },
  });

// Signal « je suis toujours là » (renvoie aussi le temps restant). Il peut porter le
// numéro de la question affichée, que l'enseignant voit dans le suivi en direct.
export const ping = (jeton: string, question?: number) =>
  appeler<{ ok: boolean; tempsRestantSecondes: number }>('/passage/ping', {
    methode: 'POST',
    jeton,
    corps: question === undefined ? undefined : { question },
  });

// Signaler un incident : sortie du plein écran ou changement d'onglet.
// Le serveur répond s'il s'agit d'un avertissement ou d'une exclusion.
export const signalerIncident = (
  jeton: string,
  type: 'sortie_plein_ecran' | 'changement_onglet',
) =>
  appeler<ResultatIncident>('/passage/incidents', {
    methode: 'POST',
    jeton,
    corps: { type },
  });

// Terminer l'évaluation, avec le code de sortie donné par l'enseignant.
export const terminer = (jeton: string, codeSortie: string) =>
  appeler<{ ok: boolean }>('/passage/terminer', {
    methode: 'POST',
    jeton,
    corps: { codeSortie },
  });