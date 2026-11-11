// Valeurs fixes utilisées par les entités.
// On les regroupe dans un seul fichier pour les retrouver facilement.

// Statut d'un établissement : c'est l'interrupteur actif / inactif
// que le super-administrateur change à la main.
export enum StatutEtablissement {
  ACTIF = 'actif',
  INACTIF = 'inactif',
}

// Rôle d'un utilisateur DANS un établissement donné.
// Le super-administrateur n'est pas un rôle d'établissement :
// voir le champ « estSuperAdmin » de l'entité Utilisateur.
export enum RoleMembre {
  ADMIN = 'admin',
  ENSEIGNANT = 'enseignant',
}

// Cycle de vie d'une évaluation, de sa création à la publication des notes.
export enum StatutEvaluation {
  BROUILLON = 'brouillon', // encore modifiable
  PLANIFIEE = 'planifiee', // prête : participants et codes en place
  EN_COURS = 'en_cours', // dans la plage horaire
  TERMINEE = 'terminee', // temps écoulé ou clôture
  CORRIGEE = 'corrigee', // toutes les notes sont saisies
  PUBLIEE = 'publiee', // notes envoyées aux étudiants
}

// Situation d'un étudiant dans UNE évaluation donnée.
export enum StatutParticipation {
  EN_ATTENTE = 'en_attente', // demande d'inscription envoyée
  REFUSE = 'refuse', // refusé par l'enseignant
  VALIDE = 'valide', // validé : peut saisir le code d'accès
  EN_COURS = 'en_cours', // l'évaluation est commencée
  EXCLU = 'exclu', // exclu après les incidents graves
  TERMINE = 'termine', // temps écoulé ou sortie avec le code
}

// Les types de questions prévus en version 1.
export enum TypeQuestion {
  QCM_UNIQUE = 'qcm_unique', // une seule bonne réponse
  QCM_MULTIPLE = 'qcm_multiple', // plusieurs bonnes réponses (tout ou rien)
  REPONSE_COURTE = 'reponse_courte', // corrigée à la main
  OUVERTE = 'ouverte', // rédaction, corrigée à la main
  CODE = 'code', // programme écrit dans l'éditeur, corrigé à la main
}

// Ce qui est enregistré dans le journal d'une participation.
export enum TypeIncident {
  SORTIE_PLEIN_ECRAN = 'sortie_plein_ecran',
  CHANGEMENT_ONGLET = 'changement_onglet',
  COUPURE = 'coupure', // connexion perdue au-delà de la tolérance
  RECONNEXION = 'reconnexion',
  EXCLUSION = 'exclusion',
  REINTEGRATION = 'reintegration',
}

// Gravité : seuls les incidents « grave » comptent pour l'exclusion.
export enum GraviteIncident {
  GRAVE = 'grave',
  INFORMATION = 'information',
}

// Résultat de l'envoi d'une note par e-mail.
export enum StatutEnvoi {
  ENVOYE = 'envoye',
  ECHEC = 'echec',
}