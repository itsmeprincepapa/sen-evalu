import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Classe } from '../database/entities/classe.entity';
import { Etudiant } from '../database/entities/etudiant.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

// Module de la gestion des classes et de leurs étudiants.
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [TypeOrmModule.forFeature([Classe, Etudiant, Evaluation]), AuthModule],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}