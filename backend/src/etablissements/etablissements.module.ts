import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import {
  EtablissementCourantController,
  SuperAdminEtablissementsController,
} from './etablissements.controller';
import { EtablissementsService } from './etablissements.service';

// Module de la gestion des établissements.
@Module({
  // « AuthModule » fournit AuthService, dont les gardes de ce module ont besoin.
  imports: [
    TypeOrmModule.forFeature([Etablissement, Utilisateur, Membre]),
    AuthModule,
  ],
  controllers: [
    SuperAdminEtablissementsController,
    EtablissementCourantController,
  ],
  providers: [EtablissementsService],
})
export class EtablissementsModule {}