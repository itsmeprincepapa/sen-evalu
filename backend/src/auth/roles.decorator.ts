import { SetMetadata } from '@nestjs/common';
import type { RoleMembre } from '../database/enums';
import { CLE_ROLES } from './constantes';

// Décorateur à placer sur une route pour dire QUELS rôles ont le droit d'y accéder.
// Exemple : @Roles(RoleMembre.ENSEIGNANT) réserve la route aux enseignants.
// (C'est ContexteEtablissementGuard qui lit cette liste et la fait respecter.)
export const Roles = (...roles: RoleMembre[]) => SetMetadata(CLE_ROLES, roles);