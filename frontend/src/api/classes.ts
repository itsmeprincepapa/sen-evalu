import type { ClasseResume, EtudiantClasse, ResumeImport } from '../types';
import { appeler } from './http';

// Les actions sur les classes. Chaque appel envoie l'établissement choisi (X-Etablissement).

export const listerClasses = (jeton: string, etablissementId: string) =>
  appeler<ClasseResume[]>('/ecole/classes', {
    methode: 'GET',
    jeton,
    etablissementId,
  });

export const creerClasse = (jeton: string, etablissementId: string, nom: string) =>
  appeler<{ id: string; nom: string }>('/ecole/classes', {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: { nom },
  });

export const renommerClasse = (
  jeton: string,
  etablissementId: string,
  classeId: string,
  nom: string,
) =>
  appeler<{ id: string; nom: string }>(`/ecole/classes/${classeId}`, {
    methode: 'PATCH',
    jeton,
    etablissementId,
    corps: { nom },
  });

export const supprimerClasse = (
  jeton: string,
  etablissementId: string,
  classeId: string,
) =>
  appeler<{ ok: boolean }>(`/ecole/classes/${classeId}`, {
    methode: 'DELETE',
    jeton,
    etablissementId,
  });

export const etudiantsDeLaClasse = (
  jeton: string,
  etablissementId: string,
  classeId: string,
) =>
  appeler<EtudiantClasse[]>(`/ecole/classes/${classeId}/etudiants`, {
    methode: 'GET',
    jeton,
    etablissementId,
  });

export const ajouterEtudiant = (
  jeton: string,
  etablissementId: string,
  classeId: string,
  donnees: { nom: string; prenom: string; email: string },
) =>
  appeler<EtudiantClasse>(`/ecole/classes/${classeId}/etudiants`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: donnees,
  });

export const retirerEtudiant = (
  jeton: string,
  etablissementId: string,
  classeId: string,
  etudiantId: string,
) =>
  appeler<{ ok: boolean }>(`/ecole/classes/${classeId}/etudiants/${etudiantId}`, {
    methode: 'DELETE',
    jeton,
    etablissementId,
  });

// Importer une liste collée. « confirmer = false » : aperçu seulement, rien n'est enregistré.
// « confirmer = true » : le serveur enregistre les lignes valides.
export const importerEtudiants = (
  jeton: string,
  etablissementId: string,
  classeId: string,
  texte: string,
  confirmer: boolean,
) =>
  appeler<ResumeImport>(`/ecole/classes/${classeId}/etudiants/import`, {
    methode: 'POST',
    jeton,
    etablissementId,
    corps: { texte, confirmer },
  });