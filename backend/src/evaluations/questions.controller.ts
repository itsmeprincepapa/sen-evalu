import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContexteEtablissementGuard } from '../auth/contexte-etablissement.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembreCourant } from '../auth/membre-courant.decorator';
import { Roles } from '../auth/roles.decorator';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { CreerQuestionDto } from './dto/creer-question.dto';
import { ModifierQuestionDto } from './dto/modifier-question.dto';
import { OrdreQuestionsDto } from './dto/ordre-questions.dto';
import { QuestionsService } from './questions.service';

// LES QUESTIONS D'UNE ÉVALUATION (enseignant propriétaire seulement).
@Controller('ecole/evaluations/:evaluationId/questions')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ENSEIGNANT)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  // GET : la liste des questions et le total des points.
  @Get()
  lister(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.questions.lister(membre, evaluationId);
  }

  // POST : créer une question (elle se place à la fin).
  @Post()
  creer(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Body() dto: CreerQuestionDto,
  ) {
    return this.questions.creer(membre, evaluationId, dto);
  }

  // PUT /ordre : réordonner (liste complète des identifiants dans le nouvel ordre).
  @Put('ordre')
  reordonner(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Body() dto: OrdreQuestionsDto,
  ) {
    return this.questions.reordonner(membre, evaluationId, dto.ids);
  }

  // PATCH /<questionId> : modifier une question.
  @Patch(':questionId')
  modifier(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: ModifierQuestionDto,
  ) {
    return this.questions.modifier(membre, evaluationId, questionId, dto);
  }

  // DELETE /<questionId> : supprimer une question (les autres sont renumérotées).
  @Delete(':questionId')
  supprimer(
    @MembreCourant() membre: Membre,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.questions.supprimer(membre, evaluationId, questionId);
  }
}