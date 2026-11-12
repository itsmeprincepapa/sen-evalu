import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { RequeteAuthentifiee } from './types';

// Garde « connexion obligatoire » : à placer devant toute route réservée aux utilisateurs
// connectés. Elle lit la session dans l'en-tête « Authorization: Bearer <jeton> »
// et range l'utilisateur dans la requête.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAuthentifiee>();

    const entete = requete.headers['authorization'];
    const jeton =
      typeof entete === 'string' && entete.startsWith('Bearer ')
        ? entete.slice(7).trim()
        : null;
    if (!jeton) {
      throw new UnauthorizedException('Connexion requise.');
    }

    requete.utilisateur = await this.auth.utilisateurDepuisJeton(jeton);
    return true;
  }
}