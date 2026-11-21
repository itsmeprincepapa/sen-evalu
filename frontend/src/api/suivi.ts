import type { InstantaneSuivi, LigneJournal } from '../types';
import { appeler } from './http';

// Les actions de l'enseignant pour le suivi d'une évaluation. Chaque appel envoie
// l'établissement choisi (X-Etablissement), que le serveur vérifie.

const base = (evaluationId: string) => `/ecole/evaluations/${evaluationId}`;

// L'état de tous les étudiants.
export const lireSuivi = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<InstantaneSuivi>(`${base(evaluationId)}/suivi`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Le journal des incidents (du plus récent au plus ancien).
export const lireJournal = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<LigneJournal[]>(`${base(evaluationId)}/journal`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Accorder du temps supplémentaire à un étudiant.
export const accorderTemps = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
  minutes: number,
) =>
  appeler<{
    tempsSupplementaireSecondes: number;
    tempsRestantSecondes: number | null;
    limiteParLaPlage: boolean; // vrai : le temps est plafonné par la fin de la plage
  }>(`${base(evaluationId)}/suivi/${participationId}/temps-supplementaire`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: { minutes },
  });

// Réintégrer un étudiant exclu (avec, si besoin, du temps supplémentaire).
export const reintegrer = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
  minutes?: number,
) =>
  appeler<{ ok: boolean; tempsRestantSecondes: number }>(
    `${base(evaluationId)}/suivi/${participationId}/reintegrer`,
    {
      methode: 'POST',
      jeton,
      etablissementId,
      corps: minutes ? { minutes } : {},
    },
  );

// Autoriser la reconnexion d'un étudiant en cours (efface sa session).
export const autoriserReconnexion = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
) =>
  appeler<{ ok: boolean }>(
    `${base(evaluationId)}/suivi/${participationId}/autoriser-reconnexion`,
    { methode: 'POST', jeton, etablissementId, corps: {} },
  );

// Terminer l'évaluation pour tous les étudiants en cours.
export const terminerPourTous = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<{ terminees: number }>(`${base(evaluationId)}/terminer`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: {},
  });