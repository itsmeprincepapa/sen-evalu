import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { InscriptionController } from './inscription.controller';
import { InscriptionService } from './inscription.service';

// Module de l'inscription des étudiants par le lien (routes publiques).
@Module({
  imports: [TypeOrmModule.forFeature([Evaluation, Participation, Etablissement])],
  controllers: [InscriptionController],
  providers: [InscriptionService],
})
export class InscriptionModule {}