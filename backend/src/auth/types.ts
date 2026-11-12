import type { Request } from 'express';
import type { Utilisateur } from '../database/entities/utilisateur.entity';

// Une requête HTTP à laquelle la garde de connexion a ajouté l'utilisateur identifié.
export interface RequeteAuthentifiee extends Request {
  utilisateur: Utilisateur;
}