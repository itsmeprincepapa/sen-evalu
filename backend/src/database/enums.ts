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