import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LimiteEssais, LimiteEssaisGuard } from '../common/limite-essais';
import { InscrireDto } from './dto/inscrire.dto';
import { StatutInscriptionDto } from './dto/statut-inscription.dto';
import { InscriptionService } from './inscription.service';

// L'INSCRIPTION PAR LE LIEN : routes PUBLIQUES (aucune connexion, l'étudiant n'a pas de compte).
// Toutes les adresses commencent par « /inscription/<lien> ».
//
// Chaque route est limitée de deux façons :
// - par étudiant (IP + lien + e-mail) : peu d'essais, pour empêcher de deviner ;
// - par IP + lien : un plafond large, car toute une classe peut se connecter derrière
//   la même adresse IP (le même Wi-Fi), mais qui bloque les essais en masse.
@Controller('inscription')
@UseGuards(LimiteEssaisGuard)
export class InscriptionController {
  constructor(private readonly service: InscriptionService) {}

  // GET /inscription/<lien> : titre, classes proposées, inscriptions ouvertes ?
  @Get(':lien')
  @LimiteEssais({ max: 200, secondes: 60, par: 'ip-lien' })
  infos(@Param('lien') lien: string) {
    return this.service.infos(lien);
  }

  // POST /inscription/<lien>/statut : où en est cette adresse e-mail ?
  @Post(':lien/statut')
  @HttpCode(200)
  @LimiteEssais(
    { max: 10, secondes: 60, par: 'ip-lien-email' },
    { max: 200, secondes: 60, par: 'ip-lien' },
  )
  statut(@Param('lien') lien: string, @Body() dto: StatutInscriptionDto) {
    return this.service.statut(lien, dto.email);
  }

  // POST /inscription/<lien> : envoyer une demande d'inscription.
  @Post(':lien')
  @LimiteEssais(
    { max: 5, secondes: 60, par: 'ip-lien-email' },
    { max: 200, secondes: 60, par: 'ip-lien' },
  )
  inscrire(@Param('lien') lien: string, @Body() dto: InscrireDto) {
    return this.service.inscrire(lien, dto);
  }
}