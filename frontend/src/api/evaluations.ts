import type {
  DetailEvaluation,
  EvaluationEnseignant,
  InscriptionLigne,
  ModificationEvaluation,
} from '../types';
import { appeler } from './http';

// Les actions de l'enseignant sur ses évaluations. Chaque appel envoie l'établissement
// choisi (X-Etablissement), que le serveur vérifie.

export const listerMesEvaluations = (jeton: string, etablissementId: string) =>
  appeler<EvaluationEnseignant[]>('/ecole/evaluations', {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Créer le brouillon d'une évaluation.
export const creerEvaluation = (
  jeton: string,
  etablissementId: string,
  donnees: {
    titre: string;
    debut: string;
    fin: string;
    dureeMinutes: number;
    classeIds: string[];
  },
) =>
  appeler<DetailEvaluation>('/ecole/evaluations', {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: donnees,
  });

// Le détail d'une évaluation, pour l'écran de modification.
export const lireEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<DetailEvaluation>(`/ecole/evaluations/${evaluationId}`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

// Modifier une évaluation (on n'envoie que ce qui change).
export const modifierEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  donnees: ModificationEvaluation,
) =>
  appeler<DetailEvaluation>(`/ecole/evaluations/${evaluationId}`, {
    methode: 'PATCH',
    jeton,
    etablissementId,
    corps: donnees,
  });

// Supprimer un brouillon sans inscription.
export const supprimerEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<{ supprimee: boolean }>(`/ecole/evaluations/${evaluationId}`, {
    methode: 'DELETE',
    jeton,
    etablissementId,
  });

// Générer (sans « code ») ou choisir (avec « code ») le code d'accès ou de sortie.
// Le serveur renvoie le code UNE SEULE FOIS.
export const definirCodeEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
  quel: 'acces' | 'sortie',
  code?: string,
) =>
  appeler<{ code: string }>(
    `/ecole/evaluations/${evaluationId}/codes/${quel}`,
    {
      methode: 'POST',
      jeton,
      etablissementId,
      corps: code ? { code } : {},
    },
  );

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

  
// Planifier : le brouillon devient « planifiée » (le lien s'ouvre aux étudiants).
// Le serveur refuse en listant ce qui manque si l'évaluation n'est pas prête.
export const planifierEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<DetailEvaluation>(`/ecole/evaluations/${evaluationId}/planifier`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: {},
  });

// Repasser en brouillon (possible tant qu'aucun étudiant n'est entré).
export const repasserEnBrouillonEvaluation = (
  jeton: string,
  etablissementId: string,
  evaluationId: string,
) =>
  appeler<DetailEvaluation>(`/ecole/evaluations/${evaluationId}/brouillon`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: {},
  });