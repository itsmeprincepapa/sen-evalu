import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { LimiteEssais, LimiteEssaisGuard } from '../common/limite-essais';
import { Utilisateur } from '../database/entities/utilisateur.entity';
import { AuthService } from './auth.service';
import { ConnexionGoogleDto } from './dto/connexion-google.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UtilisateurCourant } from './utilisateur-courant.decorator';

// Les adresses commencent toutes par « /auth ».
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /auth/google : se connecter avec le jeton remis par Google.
  // Limité : 10 essais par minute et par adresse IP.
  @Post('google')
  @HttpCode(200)
  @UseGuards(LimiteEssaisGuard)
  @LimiteEssais({ max: 10, secondes: 60, par: 'ip' })
  connexionGoogle(@Body() dto: ConnexionGoogleDto) {
    return this.auth.connecterAvecGoogle(dto.credential);
  }

  // GET /auth/moi : qui suis-je ? (utile à l'interface après un rechargement de la page)
  @Get('moi')
  @UseGuards(JwtAuthGuard)
  moi(@UtilisateurCourant() utilisateur: Utilisateur) {
    return this.auth.profil(utilisateur);
  }
}