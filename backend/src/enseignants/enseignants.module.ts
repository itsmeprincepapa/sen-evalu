import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import { EnseignantsController } from './enseignants.controller';
import { EnseignantsService } from './enseignants.service';

// Module de la gestion des enseignants par l'administrateur d'école.
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [TypeOrmModule.forFeature([Utilisateur, Membre]), AuthModule],
  controllers: [EnseignantsController],
  providers: [EnseignantsService],
})
export class EnseignantsModule {}