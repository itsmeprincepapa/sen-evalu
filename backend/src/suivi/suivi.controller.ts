import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ContexteEtablissementGuard } from '../auth/contexte-etablissement.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembreCourant } from '../auth/membre-courant.decorator';
import { Roles } from '../auth/roles.decorator';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { ReintegrerDto } from './dto/reintegrer.dto';
import { TempsSupplementaireDto } from './dto/temps-supplementaire.dto';
import { SuiviService } from './suivi.service';

// LE SUIVI D'UNE ÉVALUATION (enseignant propriétaire seulement).
// Comme pour les autres routes d'école : connecté, membre actif de l'établissement choisi,
// rôle « enseignant » ; le service vérifie ensuite que l'évaluation est la sienne.
@Controller('ecole/evaluations/:evaluationId')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ENSEIGNANT)
export class SuiviController {
  constructor(private readonly suivi: SuiviService) {}

  // GET .../suivi : les étudiants et leur état.
  @Get('suivi')
  etat(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.suivi.etat(membre, evaluationId);
  }

  // GET .../journal : tous les incidents.
  @Get('journal')
  journal(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.suivi.journal(membre, evaluationId);
  }

  // POST .../suivi/<étudiant>/temps-supplementaire : accorder du temps.
  @Post('suivi/:participationId/temps-supplementaire')
  @HttpCode(200)
  temps(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
    @Body() dto: TempsSupplementaireDto,
  ) {
    return this.suivi.accorderTemps(
      membre,
      evaluationId,
      participationId,
      dto.minutes,
    );
  }

  // POST .../suivi/<étudiant>/reintegrer : réintégrer un étudiant exclu.
  @Post('suivi/:participationId/reintegrer')
  @HttpCode(200)
  reintegrer(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
    @Body() dto: ReintegrerDto,
  ) {
    return this.suivi.reintegrer(membre, evaluationId, participationId, dto.minutes);
  }

  // POST .../suivi/<étudiant>/autoriser-reconnexion : effacer sa session.
  @Post('suivi/:participationId/autoriser-reconnexion')
  @HttpCode(200)
  autoriserReconnexion(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
  ) {
    return this.suivi.autoriserReconnexion(membre, evaluationId, participationId);
  }

  // POST .../terminer : fin anticipée de l'évaluation pour tous.
  @Post('terminer')
  @HttpCode(200)
  terminerPourTous(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.suivi.terminerPourTous(membre, evaluationId);
  }
}