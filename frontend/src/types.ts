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

// --- Classes et étudiants (étape 5) ---

// Une classe dans la liste (avec le nombre de ses étudiants).
export interface ClasseResume {
  id: string;
  nom: string;
  nbEtudiants: number;
  creeLe: string;
}

// Un étudiant d'une classe.
export interface EtudiantClasse {
  id: string;
  nom: string;
  prenom: string;
  email: string;
}

// Une ligne d'une liste collée que le serveur n'a pas pu lire.
export interface LigneErreurImport {
  ligne: number;
  contenu: string;
  raison: string;
}

// Le résumé renvoyé par le serveur pour un import (aperçu ou enregistrement).
export interface ResumeImport {
  confirme: boolean; // faux : simple aperçu, rien n'est enregistré
  lignesLues: number;
  reconnus: number;
  nouveaux: number; // inconnus de l'école : seront créés
  dejaConnusAjoutes: number; // connus de l'école : seront ajoutés à la classe
  dejaDansLaClasse: number; // rien à faire
  erreurs: LigneErreurImport[];
}

// --- Inscription des étudiants par le lien (étape 5) ---

export interface ClassePublique {
  id: string;
  nom: string;
}

// Ce que l'étudiant voit en ouvrant le lien.
export interface InfosInscription {
  titre: string;
  inscriptionsOuvertes: boolean;
  classes: ClassePublique[];
}

// Où en est une adresse e-mail pour cette évaluation.
export type StatutInscription =
  | 'inconnu' // aucune demande pour cette adresse
  | 'en_attente'
  | 'refuse'
  | 'valide'
  | 'en_cours'
  | 'exclu'
  | 'termine';

export interface ReponseStatut {
  statut: StatutInscription;
  inscriptionsOuvertes?: boolean; // présent quand le statut est « inconnu »
  nom?: string; // présents seulement pour un étudiant validé
  prenom?: string;
}

// --- Évaluations de l'enseignant et validation des inscriptions (étape 5) ---

// Les états d'une participation, tels que le serveur les renvoie.
export type StatutParticipation = Exclude<StatutInscription, 'inconnu'>;

// Une évaluation dans la liste de l'enseignant.
export interface EvaluationEnseignant {
  id: string;
  titre: string;
  statut: string; // brouillon, planifiee, en_cours, terminee, corrigee, publiee
  debut: string;
  fin: string;
  lien: string;
  inscriptionsOuvertes: boolean;
  comptes: Record<string, number>; // nombre de demandes par état, ex. { en_attente: 3 }
}

// Une demande d'inscription dans la liste de validation.
export interface InscriptionLigne {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  statut: StatutParticipation;
  classe: { id: string; nom: string } | null;
  demandeLe: string;
}

// --- Création et modification d'une évaluation (étape 6D) ---

// Les options d'une évaluation.
export interface OptionsEvaluation {
  pleinEcranObligatoire: boolean;
  detecterChangementOnglet: boolean;
  melangerQuestions: boolean;
  navigationLibre: boolean;
  retourEnArriere: boolean;
  toleranceCoupureSecondes: number;
  seuilIncidentsGraves: number;
}

// Une évaluation en détail, pour l'écran d'édition (le serveur n'envoie jamais un code).
export interface DetailEvaluation {
  id: string;
  titre: string;
  statut: string;
  debut: string; // date UTC au format ISO
  fin: string;
  dureeMinutes: number;
  lien: string;
  inscriptionsOuvertes: boolean;
  inscriptionsFermeLe: string | null;
  options: OptionsEvaluation;
  classes: ClassePublique[];
  codeAccesDefini: boolean;
  codeSortieDefini: boolean;
  nombreQuestions: number;
  nombreInscriptions: number;
  modifiable: boolean; // vrai : brouillon ou planifiée
}

// Ce qu'on envoie pour modifier : seulement les champs qui changent.
export interface ModificationEvaluation extends Partial<OptionsEvaluation> {
  titre?: string;
  debut?: string;
  fin?: string;
  dureeMinutes?: number;
  classeIds?: string[];
  inscriptionsOuvertes?: boolean;
  inscriptionsFermeLe?: string | null; // null = pas de date de fermeture
}