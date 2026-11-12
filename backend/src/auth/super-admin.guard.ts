import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequeteAuthentifiee } from './types';

// Garde « super-administrateur » : à placer APRÈS JwtAuthGuard
// (@UseGuards(JwtAuthGuard, SuperAdminGuard)), car elle lit l'utilisateur
// que JwtAuthGuard a rangé dans la requête.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(contexte: ExecutionContext): boolean {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAuthentifiee>();

    if (!requete.utilisateur?.estSuperAdmin) {
      throw new ForbiddenException('Réservé au super-administrateur.');
    }
    return true;
  }
}