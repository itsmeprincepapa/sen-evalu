import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Classe } from '../database/entities/classe.entity';
import { Etudiant } from '../database/entities/etudiant.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { ValidationInscriptionsService } from './validation-inscriptions.service';

// Module des évaluations de l'enseignant (liste, création, modification, codes,
// questions, validation des inscriptions).
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [
    TypeOrmModule.forFeature([Evaluation, Participation, Etudiant, Classe, Question]),
    AuthModule,
  ],
  controllers: [EvaluationsController, QuestionsController],
  providers: [EvaluationsService, QuestionsService, ValidationInscriptionsService],
})
export class EvaluationsModule {}