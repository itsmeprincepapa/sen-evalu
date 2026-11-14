import type { Request } from 'express';
import type { Membre } from '../database/entities/membre.entity';
import type { Utilisateur } from '../database/entities/utilisateur.entity'; 


// Une requête HTTP à laquelle la garde de connexion a ajouté l'utilisateur identifié.
export interface RequeteAuthentifiee extends Request {
  utilisateur: Utilisateur;
}

// Idem, avec en plus le rattachement de l'utilisateur à l'établissement choisi
// (placé là par la garde ContexteEtablissementGuard).
export interface RequeteAvecContexte extends RequeteAuthentifiee {
  membre: Membre;
}// --- Comptes, connexion et établissements (étape 4) ---

export type StatutEtablissement = 'actif' | 'inactif';
export type RoleMembre = 'admin' | 'enseignant';



// Le rôle de la personne dans UN établissement.
export interface Rattachement {
  etablissementId: string;
  nom: string;
  role: RoleMembre;
  statut: StatutEtablissement;
}

// Réponse de « /auth/moi » : la personne et ses établissements.
export interface Profil {
  utilisateur: Utilisateur;
  etablissements: Rattachement[];
}

// Réponse de « /auth/google » : le profil, plus la session.
export interface ReponseConnexion extends Profil {
  jeton: string;
}

export interface AdministrateurResume {
  nom: string;
  prenom: string;
  email: string;
}

// Un établissement dans la liste du super-administrateur.
export interface EtablissementListe {
  id: string;
  nom: string;
  ville: string | null;
  statut: StatutEtablissement;
  creeLe: string;
  administrateurs: AdministrateurResume[];
}