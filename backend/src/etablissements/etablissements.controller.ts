import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ContexteEtablissementGuard } from '../auth/contexte-etablissement.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembreCourant } from '../auth/membre-courant.decorator';
import { Roles } from '../auth/roles.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { AjouterAdminDto } from './dto/ajouter-admin.dto';
import { ChangerStatutDto } from './dto/changer-statut.dto';
import { CreerEtablissementDto } from './dto/creer-etablissement.dto';
import { EtablissementsService } from './etablissements.service';

// ESPACE DU SUPER-ADMINISTRATEUR (vous).
// Les deux gardes s'appliquent à TOUTES les routes de ce contrôleur, dans cet ordre :
// 1) une personne connectée, 2) qui est super-administrateur.
@Controller('super-admin/etablissements')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperAdminEtablissementsController {
  constructor(private readonly service: EtablissementsService) {}

  // GET /super-admin/etablissements : la liste.
  @Get()
  lister() {
    return this.service.lister();
  }

  // POST /super-admin/etablissements : créer un établissement.
  @Post()
  creer(@Body() dto: CreerEtablissementDto) {
    return this.service.creer(dto);
  }

  // POST /super-admin/etablissements/<id>/administrateurs : nommer son administrateur.
  @Post(':id/administrateurs')
  ajouterAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AjouterAdminDto,
  ) {
    return this.service.ajouterAdministrateur(id, dto);
  }

  // PATCH /super-admin/etablissements/<id>/statut : l'interrupteur actif / inactif.
  @Patch(':id/statut')
  changerStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangerStatutDto,
  ) {
    return this.service.changerStatut(id, dto.statut);
  }
}

// ESPACE DES ÉCOLES : un administrateur ou un enseignant demande des informations
// sur l'établissement qu'il a choisi (en-tête X-Etablissement).
// Cette route sert aussi de MODÈLE pour toutes les futures routes d'école.
@Controller('etablissements')
export class EtablissementCourantController {
  // GET /etablissements/courant
  @Get('courant')
  @UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
  @Roles(RoleMembre.ADMIN, RoleMembre.ENSEIGNANT)
  courant(@MembreCourant() membre: Membre) {
    return {
      id: membre.etablissementId,
      nom: membre.etablissement.nom,
      ville: membre.etablissement.ville,
      role: membre.role,
    };
  }
}