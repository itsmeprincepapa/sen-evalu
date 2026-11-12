import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Participation } from '../database/entities/participation.entity';
import { RequeteAvecParticipation } from './session-etudiant.guard';

// Décorateur de paramètre : permet d'écrire @ParticipationCourante() dans une route
// pour obtenir la participation de l'étudiant connecté (placée là par la garde).
export const ParticipationCourante = createParamDecorator(
  (_donnees: unknown, contexte: ExecutionContext): Participation => {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAvecParticipation>();
    return requete.participation;
  },
);