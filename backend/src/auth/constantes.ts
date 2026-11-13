// Durée d'une session de connexion : 8 heures (en secondes).
// C'est une journée de travail ; ensuite on se reconnecte avec Google en un clic.
export const DUREE_SESSION_SECONDES = 8 * 60 * 60;

// Nom sous lequel les rôles autorisés d'une route sont rangés (voir roles.decorator.ts).
export const CLE_ROLES = 'roles';