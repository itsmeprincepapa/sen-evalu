import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Classe } from '../database/entities/classe.entity';
import { Etudiant } from '../database/entities/etudiant.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { ValidationInscriptionsService } from './validation-inscriptions.service';

// Module des évaluations de l'enseignant (liste et validation des inscriptions pour l'instant).
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [
    TypeOrmModule.forFeature([Evaluation, Participation, Etudiant, Classe]),
    AuthModule,
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, ValidationInscriptionsService],
})
export class EvaluationsModule {}