import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DUREE_SESSION_SECONDES } from './constantes';

// Module de la connexion. Les autres modules qui veulent protéger leurs routes
// l'importent : il leur fournit AuthService (qui sert aux gardes).
@Module({
  imports: [
    TypeOrmModule.forFeature([Utilisateur, Membre]),
    // Réglage des sessions : la clé secrète vient du fichier .env.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: DUREE_SESSION_SECONDES },
        // On n'accepte que l'algorithme que nous utilisons nous-mêmes.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}