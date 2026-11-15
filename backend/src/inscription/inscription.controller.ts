import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { InscrireDto } from './dto/inscrire.dto';
import { StatutInscriptionDto } from './dto/statut-inscription.dto';
import { InscriptionService } from './inscription.service';

// L'INSCRIPTION PAR LE LIEN : routes PUBLIQUES (aucune garde, l'étudiant n'a pas de compte).
// Toutes les adresses commencent par « /inscription/<lien> ».
@Controller('inscription')
export class InscriptionController {
  constructor(private readonly service: InscriptionService) {}

  // GET /inscription/<lien> : titre, classes proposées, inscriptions ouvertes ?
  @Get(':lien')
  infos(@Param('lien') lien: string) {
    return this.service.infos(lien);
  }

  // POST /inscription/<lien>/statut : où en est cette adresse e-mail ?
  @Post(':lien/statut')
  @HttpCode(200)
  statut(@Param('lien') lien: string, @Body() dto: StatutInscriptionDto) {
    return this.service.statut(lien, dto.email);
  }

  // POST /inscription/<lien> : envoyer une demande d'inscription.
  @Post(':lien')
  inscrire(@Param('lien') lien: string, @Body() dto: InscrireDto) {
    return this.service.inscrire(lien, dto);
  }
}