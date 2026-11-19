import type { RoleMembre } from '../types';

// Texte affiché pour chaque rôle.
export const LIBELLES_ROLE: Record<RoleMembre, string> = {
  admin: 'Administrateur',
  enseignant: 'Enseignant',
};

// Texte affiché pour chaque état d'une évaluation.
export const LIBELLES_STATUT_EVALUATION: Record<string, string> = {
  brouillon: 'Brouillon',
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  corrigee: 'Corrigée',
  publiee: 'Notes publiées',
};

// Texte affiché pour chaque état d'une demande d'inscription.
export const LIBELLES_STATUT_PARTICIPATION: Record<string, string> = {
  en_attente: 'En attente',
  refuse: 'Refusée',
  valide: 'Validée',
  en_cours: 'En cours',
  exclu: 'Exclu',
  termine: 'Terminée',
};


// Texte affiché pour chaque type de question.
export const LIBELLES_TYPE_QUESTION: Record<string, string> = {
  qcm_unique: 'QCM (une seule réponse)',
  qcm_multiple: 'QCM (plusieurs réponses)',
  reponse_courte: 'Réponse courte',
  ouverte: 'Question ouverte',
  code: 'Question de code',
};