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
}