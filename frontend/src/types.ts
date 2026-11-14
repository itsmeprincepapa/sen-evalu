// Types TypeScript décrivant les données échangées avec le serveur.
// (Ce fichier ne contient que des types : il disparaît à la compilation.)

export type TypeQuestion =
  | 'qcm_unique'
  | 'qcm_multiple'
  | 'reponse_courte'
  | 'ouverte'
  | 'code';

// Le contenu d'une réponse : un texte, ou une liste d'identifiants de
// propositions cochées (QCM).
export type Contenu = string | string[];

export interface OptionQcm {
  id: string;
  texte: string; // NB : le serveur n'envoie jamais « correcte »
}

export interface Question {
  id: string;
  ordre: number;
  type: TypeQuestion;
  enonce: string;
  points: number;
  langage: string | null; // pour les questions de code
  options: OptionQcm[] | null; // pour les QCM
}

// Une réponse déjà enregistrée par le serveur.
export interface ReponseServeur {
  questionId: string;
  contenu: Contenu | null;
  version: number;
}

export interface InfosEvaluation {
  titre: string;
  navigationLibre: boolean;
  retourEnArriere: boolean;
  melangerQuestions: boolean;
  pleinEcranObligatoire: boolean;
  detecterChangementOnglet: boolean;
}

// Tout ce qu'il faut pour afficher l'évaluation (réponse de « /passage/etat »).
export interface Etat {
  statut: string;
  etudiant: { nom: string; prenom: string };
  evaluation: InfosEvaluation;
  questions: Question[];
  reponses: ReponseServeur[];
  tempsRestantSecondes: number;
  heureServeur: string;
}

// Réponse de « /passage/entrer » : l'état, plus le jeton de session.
export interface Entree extends Etat {
  jeton: string;
}

// Réponse du serveur à une sauvegarde.
export interface AccuseSauvegarde {
  ok: boolean;
  ignoree: boolean;
  version: number;
  tempsRestantSecondes: number;
}

// --- Comptes, connexion et établissements (étape 4) ---

export type StatutEtablissement = 'actif' | 'inactif';
export type RoleMembre = 'admin' | 'enseignant';

// La personne connectée.
export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  estSuperAdmin: boolean;
}

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

// Un enseignant dans la liste de l'administrateur d'école.
export interface Enseignant {
  membreId: string;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean; // faux : l'administrateur a retiré son accès
  dejaConnecte: boolean; // vrai : il s'est déjà connecté une fois avec Google
  ajouteLe: string;
}