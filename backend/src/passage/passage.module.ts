import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Incident } from '../database/entities/incident.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { Reponse } from '../database/entities/reponse.entity';
import { ClotureAutomatiqueService } from './cloture-automatique.service';
import { PassageController } from './passage.controller';
import { PassageService } from './passage.service';
import { SessionEtudiantGuard } from './session-etudiant.guard';

// Un module regroupe tout ce qui concerne UNE fonction de l'application :
// ici, le passage d'une évaluation par un étudiant.
@Module({
  // Les tables auxquelles ce module a le droit d'accéder.
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      Participation,
      Question,
      Reponse,
      Etablissement,
      Incident,
    ]),
  ],
  controllers: [PassageController],
  // Le service de clôture automatique démarre avec le serveur.
  providers: [PassageService, SessionEtudiantGuard, ClotureAutomatiqueService],
})
export class PassageModule {}