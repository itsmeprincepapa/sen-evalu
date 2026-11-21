import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Incident } from '../database/entities/incident.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { BusSuivi } from './bus-suivi';
import { SuiviController } from './suivi.controller';
import { SuiviGateway } from './suivi.gateway';
import { SuiviService } from './suivi.service';

// Module du suivi d'une évaluation par l'enseignant : état des étudiants, journal,
// actions (temps supplémentaire, réintégration, reconnexion, fin anticipée) et passerelle
// temps réel. Il exporte le « bus » pour que le passage puisse annoncer ce qui se passe.
@Module({
  // « AuthModule » fournit AuthService, dont les gardes et la passerelle ont besoin.
  imports: [
    TypeOrmModule.forFeature([Evaluation, Participation, Incident, Question]),
    AuthModule,
  ],
  controllers: [SuiviController],
  providers: [SuiviService, BusSuivi, SuiviGateway],
  exports: [BusSuivi],
})
export class SuiviModule {}