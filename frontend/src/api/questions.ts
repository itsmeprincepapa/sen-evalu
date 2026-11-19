import type { DonneesQuestion, ListeQuestions, QuestionEnseignant } from '../types';
import { appeler } from './http';

// Les actions de l'enseignant sur les questions d'une évaluation.
// Chaque appel envoie l'établissement choisi (X-Etablissement), que le serveur vérifie.

const base = (evaluationId: string) => `/ecole/evaluations/${evaluationId}/questions`;

export const listerQuestions = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<ListeQuestions>(base(evaluationId), {
    methode: 'GET',
    jeton,
    etablissementId,
  });

export const creerQuestion = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  donnees: DonneesQuestion,
) =>
  appeler<QuestionEnseignant>(base(evaluationId), {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: donnees,
  });

export const modifierQuestion = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  questionId: string,
  donnees: DonneesQuestion,
) =>
  appeler<QuestionEnseignant>(`${base(evaluationId)}/${questionId}`, {
    methode: 'PATCH',
    jeton,
    etablissementId,
    corps: donnees,
  });

export const supprimerQuestion = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  questionId: string,
) =>
  appeler<{ supprimee: boolean }>(`${base(evaluationId)}/${questionId}`, {
    methode: 'DELETE',
    jeton,
    etablissementId,
  });

// Nouvel ordre : la liste COMPLÈTE des identifiants dans l'ordre voulu.
export const reordonnerQuestions = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  ids: string[],
) =>
  appeler<ListeQuestions>(`${base(evaluationId)}/ordre`, {
    methode: 'PUT',
    jeton,
    etablissementId,
    corps: { ids },
  });