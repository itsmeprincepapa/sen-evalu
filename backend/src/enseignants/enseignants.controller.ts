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
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { ChangerAccesDto } from './dto/changer-acces.dto';
import { InviterEnseignantDto } from './dto/inviter-enseignant.dto';
import { EnseignantsService } from './enseignants.service';

// ESPACE DE L'ADMINISTRATEUR D'ÉCOLE : gérer ses enseignants.
// Pour TOUTES les routes : une personne connectée (JwtAuthGuard), membre actif de
// l'établissement choisi dans l'en-tête X-Etablissement (ContexteEtablissementGuard),
// avec le rôle d'ADMINISTRATEUR (@Roles).
@Controller('ecole/enseignants')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ADMIN)
export class EnseignantsController {
  constructor(private readonly service: EnseignantsService) {}

  // GET /ecole/enseignants : la liste.
  @Get()
  lister(@MembreCourant() membre: Membre) {
    return this.service.lister(membre.etablissementId);
  }

  // POST /ecole/enseignants : inviter un enseignant.
  @Post()
  inviter(@MembreCourant() membre: Membre, @Body() dto: InviterEnseignantDto) {
    return this.service.inviter(membre.etablissementId, dto);
  }

  // PATCH /ecole/enseignants/<membreId>/acces : retirer ou rétablir son accès.
  @Patch(':membreId/acces')
  changerAcces(
    @MembreCourant() membre: Membre,
    @Param('membreId', ParseUUIDPipe) membreId: string,
    @Body() dto: ChangerAccesDto,
  ) {
    return this.service.changerAcces(membre.etablissementId, membreId, dto.actif);
  }
}