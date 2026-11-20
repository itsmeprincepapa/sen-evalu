import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Incident } from '../database/entities/incident.entity';
import { Participation } from '../database/entities/participation.entity';
import { SuiviController } from './suivi.controller';
import { SuiviService } from './suivi.service';

// Module du suivi d'une évaluation par l'enseignant : état des étudiants, journal,
// actions (temps supplémentaire, réintégration, reconnexion, fin anticipée).
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [
    TypeOrmModule.forFeature([Evaluation, Participation, Incident]),
    AuthModule,
  ],
  controllers: [SuiviController],
  providers: [SuiviService],
})
export class SuiviModule {}