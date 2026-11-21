import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContexteEtablissementGuard } from '../auth/contexte-etablissement.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembreCourant } from '../auth/membre-courant.decorator';
import { Roles } from '../auth/roles.decorator';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { CorrectionService } from './correction.service';
import { NoterQuestionDto } from './dto/noter-question.dto';

// LA CORRECTION D'UNE ÉVALUATION (enseignant propriétaire seulement).
// Comme pour les autres routes d'école : connecté, membre actif de l'établissement choisi,
// rôle « enseignant » ; le service vérifie ensuite que l'évaluation est la sienne.
@Controller('ecole/evaluations/:evaluationId/correction')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ENSEIGNANT)
export class CorrectionController {
  constructor(private readonly correction: CorrectionService) {}

  // GET .../correction : les copies, leurs notes, et le compteur « N corrigées sur M ».
  @Get()
  etat(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.correction.etat(membre, evaluationId);
  }

  // GET .../correction/<copie> : une copie, question par question.
  @Get(':participationId')
  copie(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
  ) {
    return this.correction.copie(membre, evaluationId, participationId);
  }

  // PUT .../correction/<copie>/questions/<question> : noter une réponse écrite.
  @Put(':participationId/questions/:questionId')
  noter(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('participationId', ParseUUIDPipe) participationId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: NoterQuestionDto,
  ) {
    return this.correction.noter(
      membre,
      evaluationId,
      participationId,
      questionId,
      dto,
    );
  }
}