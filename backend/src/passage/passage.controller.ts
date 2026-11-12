import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Participation } from '../database/entities/participation.entity';
import { EntrerDto } from './dto/entrer.dto';
import { SauvegarderDto } from './dto/sauvegarder.dto';
import { ParticipationCourante } from './participation-courante.decorator';
import { PassageService } from './passage.service';
import { SessionEtudiantGuard } from './session-etudiant.guard';

// Les adresses commencent toutes par « /passage ».
// Le contrôleur ne fait que RECEVOIR les requêtes et passer la main au service.
@Controller('passage')
export class PassageController {
  constructor(private readonly passage: PassageService) {}

  // POST /passage/entrer : la seule route SANS jeton (c'est elle qui le délivre).
  // « HttpCode(200) » : par défaut un POST répond 201 (créé), ce n'est pas le cas ici.
  @Post('entrer')
  @HttpCode(200)
  entrer(@Body() dto: EntrerDto) {
    return this.passage.entrer(dto);
  }

  // Toutes les routes suivantes exigent un jeton valide (« UseGuards »).

  // GET /passage/etat : questions, réponses déjà saisies, temps restant.
  @Get('etat')
  @UseGuards(SessionEtudiantGuard)
  etat(@ParticipationCourante() participation: Participation) {
    return this.passage.etat(participation);
  }

  // PUT /passage/reponses/<id de la question> : sauvegarde une réponse.
  // « ParseUUIDPipe » refuse tout identifiant qui n'a pas la forme d'un UUID.
  @Put('reponses/:questionId')
  @UseGuards(SessionEtudiantGuard)
  sauvegarder(
    @ParticipationCourante() participation: Participation,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: SauvegarderDto,
  ) {
    return this.passage.sauvegarder(participation, questionId, dto);
  }

  // POST /passage/ping : signal « je suis toujours là ».
  @Post('ping')
  @HttpCode(200)
  @UseGuards(SessionEtudiantGuard)
  ping(@ParticipationCourante() participation: Participation) {
    return this.passage.ping(participation);
  }

  // POST /passage/terminer : l'étudiant a fini.
  @Post('terminer')
  @HttpCode(200)
  @UseGuards(SessionEtudiantGuard)
  terminer(@ParticipationCourante() participation: Participation) {
    return this.passage.terminer(participation);
  }
}