import {
  Body,
  Controller,
  Delete,
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
import { CreerEvaluationDto } from './dto/creer-evaluation.dto';
import { DefinirCodeDto } from './dto/definir-code.dto';
import { ModifierEvaluationDto } from './dto/modifier-evaluation.dto';
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

  // POST /ecole/evaluations : créer un brouillon.
  @Post()
  creer(@MembreCourant() membre: Membre, @Body() dto: CreerEvaluationDto) {
    return this.evaluations.creer(membre, dto);
  }

  // GET /ecole/evaluations/<id> : le détail pour l'écran d'édition (jamais de code).
  @Get(':id')
  detail(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.detail(membre, id);
  }

  // PATCH /ecole/evaluations/<id> : modifier (on n'envoie que ce qui change).
  @Patch(':id')
  modifier(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierEvaluationDto,
  ) {
    return this.evaluations.modifier(membre, id, dto);
  }

  // DELETE /ecole/evaluations/<id> : supprimer un brouillon sans inscription.
  @Delete(':id')
  supprimer(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.supprimer(membre, id);
  }

  // POST /ecole/evaluations/<id>/codes/acces : (re)génère le code d'accès.
  @Post(':id/codes/acces')
  @HttpCode(200)
  codeAcces(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefinirCodeDto,
  ) {
    return this.evaluations.definirCode(membre, id, 'acces', dto);
  }

  // POST /ecole/evaluations/<id>/codes/sortie : (re)génère le code de sortie.
  @Post(':id/codes/sortie')
  @HttpCode(200)
  codeSortie(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefinirCodeDto,
  ) {
    return this.evaluations.definirCode(membre, id, 'sortie', dto);
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