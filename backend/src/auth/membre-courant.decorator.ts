import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Membre } from '../database/entities/membre.entity';
import type { RequeteAvecContexte } from './types';

// Permet d'écrire @MembreCourant() dans une route pour obtenir le rattachement
// (personne + établissement + rôle) validé par ContexteEtablissementGuard.
export const MembreCourant = createParamDecorator(
  (_donnees: unknown, contexte: ExecutionContext): Membre => {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAvecContexte>();
    return requete.membre;
  },
);