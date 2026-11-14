import type { Enseignant } from '../types';
import { appeler } from './http';

// Les actions d'une école. Chaque appel envoie l'établissement choisi (en-tête X-Etablissement),
// que le serveur vérifie avant de répondre.

export const listerEnseignants = (jeton: string, etablissementId: string) =>
  appeler<Enseignant[]>('/ecole/enseignants', {
    methode: 'GET',
    jeton,
    etablissementId,
  });

export const inviterEnseignant = (
  jeton: string,
  etablissementId: string,
  donnees: { email: string; nom: string; prenom: string },
) =>
  appeler<{ membreId: string }>('/ecole/enseignants', {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: donnees,
  });

// Retirer (actif = false) ou rétablir (actif = true) l'accès d'un enseignant.
export const changerAccesEnseignant = (
  jeton: string,
  etablissementId: string,
  membreId: string,
  actif: boolean,
) =>
  appeler<{ membreId: string; actif: boolean }>(
    `/ecole/enseignants/${membreId}/acces`,
    { methode: 'PATCH', jeton, etablissementId, corps: { actif } },
  );