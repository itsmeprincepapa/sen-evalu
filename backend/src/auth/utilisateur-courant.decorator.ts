import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Utilisateur } from '../database/entities/utilisateur.entity';
import type { RequeteAuthentifiee } from './types';

// Permet d'écrire @UtilisateurCourant() dans une route pour obtenir
// l'utilisateur connecté (placé là par JwtAuthGuard).
export const UtilisateurCourant = createParamDecorator(
  (_donnees: unknown, contexte: ExecutionContext): Utilisateur => {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAuthentifiee>();
    return requete.utilisateur;
  },
);