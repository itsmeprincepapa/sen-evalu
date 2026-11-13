import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { toutesLesEntites } from './database/entities';
import { PassageModule } from './passage/passage.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { EtablissementsModule } from './etablissements/etablissements.module';

@Module({
  imports: [
    // Lit le fichier .env et rend ses valeurs disponibles dans toute l'application
    ConfigModule.forRoot({ isGlobal: true }),

    // Connexion à MySQL. « forRootAsync » attend que le .env soit lu
    // avant de construire la configuration.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        // getOrThrow : le serveur refuse de démarrer si la variable manque dans .env
        host: config.getOrThrow<string>('DB_HOST'),
        // Les valeurs du .env sont du texte : on convertit le port en nombre
        port: Number(config.get('DB_PORT', '3306')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        // Même encodage que la base : accents et caractères spéciaux
        charset: 'utf8mb4',
                // « Z » = heure universelle (UTC) : toutes les dates sont enregistrées
        // de la même façon, sans décalage entre votre ordinateur et un futur hébergeur.
        timezone: 'Z',
                // La liste de nos tables (entités), définie dans database/entities/index.ts
        entities: toutesLesEntites,
        // NE JAMAIS METTRE true : la structure de la base ne doit changer
        // que par des migrations, jamais automatiquement (risque de perte de données)
        synchronize: false,
      }),
    }),

        // Active les tâches automatiques (@Interval). À appeler UNE SEULE FOIS, ici.
    ScheduleModule.forRoot(),
    
        // La connexion Google et les sessions
    AuthModule,

        // La gestion des établissements (super-administrateur) et le contexte d'établissement
    EtablissementsModule,
    
        // Le passage d'une évaluation par un étudiant
    PassageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}