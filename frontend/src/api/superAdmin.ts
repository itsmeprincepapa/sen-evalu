import type { EtablissementListe, StatutEtablissement } from '../types';
import { appeler } from './http';

// Les actions du super-administrateur sur les établissements.

export const listerEtablissements = (jeton: string) =>
  appeler<EtablissementListe[]>('/super-admin/etablissements', {
    methode: 'GET',
    jeton,
  });

export const creerEtablissement = (jeton: string, nom: string, ville: string) =>
  appeler<{ id: string }>('/super-admin/etablissements', {
    methode: 'POST',
    jeton,
    // Une ville vide n'est pas envoyée du tout (JSON ignore « undefined »).
    corps: { nom, ville: ville || undefined },
  });

export const ajouterAdministrateur = (
  jeton: string,
  etablissementId: string,
  donnees: { email: string; nom: string; prenom: string },
) =>
  appeler<{ utilisateurId: string }>(
    `/super-admin/etablissements/${etablissementId}/administrateurs`,
    { methode: 'POST', jeton, corps: donnees },
  );

// L'interrupteur actif / inactif.
export const changerStatut = (
  jeton: string,
  etablissementId: string,
  statut: StatutEtablissement,
) =>
  appeler<{ id: string; statut: StatutEtablissement }>(
    `/super-admin/etablissements/${etablissementId}/statut`,
    { methode: 'PATCH', jeton, corps: { statut } },
  );