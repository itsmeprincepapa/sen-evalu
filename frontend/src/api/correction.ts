import type { CopieACorriger, EtatCorrection, ResultatNote } from '../types';
import { appeler } from './http';

// Les actions de l'enseignant pour la correction. Chaque appel envoie l'établissement
// choisi (X-Etablissement), que le serveur vérifie.

const base = (evaluationId: string) =>
  `/ecole/evaluations/${evaluationId}/correction`;

// Le tableau des résultats et le compteur « N corrigées sur M ».
export const lireCorrection = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<EtatCorrection>(base(evaluationId), {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Une copie, question par question.
export const lireCopie = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
) =>
  appeler<CopieACorriger>(`${base(evaluationId)}/${participationId}`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Noter une réponse écrite (note de 0 aux points de la question, commentaire facultatif).
export const noterQuestion = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  participationId: string,
  questionId: string,
  note: number,
  commentaire: string,
) =>
  appeler<ResultatNote>(
    `${base(evaluationId)}/${participationId}/questions/${questionId}`,
    {
      methode: 'PUT',
      jeton,
      etablissementId,
      corps: { note, commentaire },
    },
  );