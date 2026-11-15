import type { InfosInscription, ReponseStatut, StatutInscription } from '../types';
import { appeler } from './http';

// Les appels PUBLICS de l'inscription par le lien (pas de jeton : l'étudiant n'a pas de compte).

export const lireInfos = (lien: string) =>
  appeler<InfosInscription>(`/inscription/${lien}`, { methode: 'GET' });

export const lireStatut = (lien: string, email: string) =>
  appeler<ReponseStatut>(`/inscription/${lien}/statut`, {
    methode: 'POST',
    corps: { email },
  });

export const sinscrire = (
  lien: string,
  donnees: { nom: string; prenom: string; email: string; classeId: string },
) =>
  appeler<{ statut: StatutInscription }>(`/inscription/${lien}`, {
    methode: 'POST',
    corps: donnees,
  });