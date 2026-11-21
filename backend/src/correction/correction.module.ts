import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { Reponse } from '../database/entities/reponse.entity';
import { CorrectionController } from './correction.controller';
import { CorrectionService } from './correction.service';

// Module de la correction : notes automatiques des QCM, totaux, correction manuelle.
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [
    TypeOrmModule.forFeature([Evaluation, Participation, Question, Reponse]),
    AuthModule,
  ],
  controllers: [CorrectionController],
  providers: [CorrectionService],
})
export class CorrectionModule {}