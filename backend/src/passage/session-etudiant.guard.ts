import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Participation } from '../database/entities/participation.entity';

// Une requête HTTP à laquelle la garde a ajouté la participation de l'étudiant.
export interface RequeteAvecParticipation extends Request {
  participation: Participation;
}

// Une « garde » s'exécute AVANT une route et décide si l'accès est permis.
// Celle-ci identifie l'étudiant grâce à son jeton de session (reçu à l'entrée).
@Injectable()
export class SessionEtudiantGuard implements CanActivate {
  constructor(
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAvecParticipation>();

    // Le jeton arrive dans l'en-tête « Authorization: Bearer <jeton> ».
    const entete = requete.headers['authorization'];
    const jeton =
      typeof entete === 'string' && entete.startsWith('Bearer ')
        ? entete.slice(7).trim()
        : null;
    if (!jeton) {
      throw new UnauthorizedException('Session manquante.');
    }

    // On retrouve la participation qui possède ce jeton (grâce à l'index).
    const participation = await this.participations.findOneBy({
      sessionId: jeton,
    });
    if (!participation) {
      // Jeton inconnu, ou remplacé par une nouvelle connexion du même étudiant.
      throw new UnauthorizedException('Session invalide.');
    }

    // On la range dans la requête : les routes la récupèrent avec @ParticipationCourante().
    requete.participation = participation;
    return true;
  }
}