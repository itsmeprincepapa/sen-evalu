import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ChoixInscriptionsDto } from './dto/choix-inscriptions.dto';
import { CorrigerInscriptionDto } from './dto/corriger-inscription.dto';
import { EvaluationsService } from './evaluations.service';
import { ValidationInscriptionsService } from './validation-inscriptions.service';

// LES ÉVALUATIONS DE L'ENSEIGNANT.
// Pour TOUTES les routes : une personne connectée (JwtAuthGuard), membre actif de
// l'établissement choisi (ContexteEtablissementGuard), avec le rôle ENSEIGNANT.
// Le service limite ensuite chaque action aux évaluations DONT IL EST LE PROPRIÉTAIRE.
@Controller('ecole/evaluations')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ENSEIGNANT)
export class EvaluationsController {
  constructor(
    private readonly evaluations: EvaluationsService,
    private readonly validation: ValidationInscriptionsService,
  ) {}

  // GET /ecole/evaluations : mes évaluations.
  @Get()
  lister(@MembreCourant() membre: Membre) {
    return this.evaluations.listerMesEvaluations(membre);
  }

  // GET /ecole/evaluations/<id>/inscriptions : les demandes d'inscription.
  @Get(':id/inscriptions')
  inscriptions(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.validation.lister(membre, id);
  }

  // POST /ecole/evaluations/<id>/inscriptions/valider : valider la sélection, ou tout.
  @Post(':id/inscriptions/valider')
  @HttpCode(200)
  valider(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() choix: ChoixInscriptionsDto,
  ) {
    return this.validation.valider(membre, id, choix);
  }

  // POST /ecole/evaluations/<id>/inscriptions/refuser : refuser la sélection.
  @Post(':id/inscriptions/refuser')
  @HttpCode(200)
  refuser(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() choix: ChoixInscriptionsDto,
  ) {
    return this.validation.refuser(membre, id, choix.ids ?? []);
  }

  // PATCH /ecole/evaluations/<id>/inscriptions/<demandeId> : corriger une demande.
  @Patch(':id/inscriptions/:participationId')
  corriger(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
    @Body() dto: CorrigerInscriptionDto,
  ) {
    return this.validation.corriger(membre, id, participationId, dto);
  }
}