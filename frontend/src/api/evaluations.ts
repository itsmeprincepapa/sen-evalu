import type { EvaluationEnseignant, InscriptionLigne } from '../types';
import { appeler } from './http';

// Les actions de l'enseignant sur ses évaluations. Chaque appel envoie l'établissement
// choisi (X-Etablissement), que le serveur vérifie.

export const listerMesEvaluations = (jeton: string, etablissementId: string) =>
  appeler<EvaluationEnseignant[]>('/ecole/evaluations', {
    methode: 'GET',
    jeton,
    etablissementId,
  });

export const listerInscriptions = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<InscriptionLigne[]>(`/ecole/evaluations/${evaluationId}/inscriptions`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Valider la sélection (ids) ou toutes les demandes en attente (tous).
export const validerInscriptions = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  choix: { ids?: string[]; tous?: boolean },
) =>
  appeler<{ valides: number }>(
    `/ecole/evaluations/${evaluationId}/inscriptions/valider`,
    { methode: 'POST', jeton, etablissementId, corps: choix },
  );

export const refuserInscriptions = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  ids: string[],
) =>
  appeler<{ refuses: number }>(
    `/ecole/evaluations/${evaluationId}/inscriptions/refuser`,
    { methode: 'POST', jeton, etablissementId, corps: { ids } },
  );

export const corrigerInscription = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
  donnees: { email?: string; nom?: string; prenom?: string },
) =>
  appeler<{ id: string }>(
    `/ecole/evaluations/${evaluationId}/inscriptions/${participationId}`,
    { methode: 'PATCH', jeton, etablissementId, corps: donnees },
  );