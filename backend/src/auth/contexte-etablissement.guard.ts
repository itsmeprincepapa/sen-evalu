import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { RoleMembre } from '../database/enums';
import { AuthService } from './auth.service';
import { CLE_ROLES } from './constantes';
import type { RequeteAvecContexte } from './types';

// Garde « établissement choisi » : à placer APRÈS JwtAuthGuard sur toute route d'école.
//   @UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
// Elle lit l'en-tête « X-Etablissement » et vérifie, à CHAQUE requête :
//  - que la personne est bien membre de cet établissement,
//  - que l'établissement est ACTIF (l'interrupteur du super-administrateur),
//  - que son rôle est autorisé (liste donnée par @Roles(...) sur la route).
@Injectable()
export class ContexteEtablissementGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    // Le « Reflector » lit les informations posées par des décorateurs comme @Roles.
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const requete = contexte
      .switchToHttp()
      .getRequest<RequeteAvecContexte>();

    // 1. L'établissement demandé, lu dans l'en-tête.
    const idEtablissement = requete.headers['x-etablissement'];
    if (typeof idEtablissement !== 'string' || !isUUID(idEtablissement)) {
      throw new BadRequestException(
        'En-tête X-Etablissement manquant ou invalide.',
      );
    }

    // 2. Les rôles autorisés pour cette route (posés par @Roles sur la route ou le contrôleur).
    const rolesAutorises = this.reflector.getAllAndOverride<
      RoleMembre[] | undefined
    >(CLE_ROLES, [contexte.getHandler(), contexte.getClass()]);

    // 3. Vérification complète, puis on range le rattachement dans la requête.
    requete.membre = await this.auth.membreActif(
      requete.utilisateur,
      idEtablissement,
      rolesAutorises,
    );
    return true;
  }
}