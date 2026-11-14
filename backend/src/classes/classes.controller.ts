import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ContexteEtablissementGuard } from '../auth/contexte-etablissement.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembreCourant } from '../auth/membre-courant.decorator';
import { Roles } from '../auth/roles.decorator';
import { Membre } from '../database/entities/membre.entity';
import { RoleMembre } from '../database/enums';
import { ClassesService } from './classes.service';
import { AjouterEtudiantDto } from './dto/ajouter-etudiant.dto';
import { ClasseDto } from './dto/classe.dto';
import { ImporterEtudiantsDto } from './dto/importer-etudiants.dto';

// LES CLASSES D'UNE ÉCOLE. Ouvert aux administrateurs ET aux enseignants de l'école.
// Pour TOUTES les routes : une personne connectée (JwtAuthGuard), membre actif de
// l'établissement choisi dans l'en-tête X-Etablissement (ContexteEtablissementGuard).
@Controller('ecole/classes')
@UseGuards(JwtAuthGuard, ContexteEtablissementGuard)
@Roles(RoleMembre.ADMIN, RoleMembre.ENSEIGNANT)
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  // GET /ecole/classes : la liste, avec le nombre d'étudiants.
  @Get()
  lister(@MembreCourant() membre: Membre) {
    return this.service.lister(membre.etablissementId);
  }

  // POST /ecole/classes : créer une classe.
  @Post()
  creer(@MembreCourant() membre: Membre, @Body() dto: ClasseDto) {
    return this.service.creer(membre.etablissementId, dto);
  }

  // PATCH /ecole/classes/<id> : renommer.
  @Patch(':id')
  renommer(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClasseDto,
  ) {
    return this.service.renommer(membre.etablissementId, id, dto);
  }

  // DELETE /ecole/classes/<id> : supprimer (refusé si une évaluation y est rattachée).
  @Delete(':id')
  supprimer(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.supprimer(membre.etablissementId, id);
  }

  // GET /ecole/classes/<id>/etudiants : les étudiants de la classe.
  @Get(':id/etudiants')
  etudiants(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.etudiantsDeLaClasse(membre.etablissementId, id);
  }

  // POST /ecole/classes/<id>/etudiants : ajouter un étudiant.
  @Post(':id/etudiants')
  ajouterEtudiant(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AjouterEtudiantDto,
  ) {
    return this.service.ajouterEtudiant(membre.etablissementId, id, dto);
  }

  // POST /ecole/classes/<id>/etudiants/import : importer une liste collée
  // (aperçu, puis enregistrement quand « confirmer » vaut true).
  @Post(':id/etudiants/import')
  importer(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImporterEtudiantsDto,
  ) {
    return this.service.importer(
      membre.etablissementId,
      id,
      dto.texte,
      dto.confirmer === true,
    );
  }

  // DELETE /ecole/classes/<id>/etudiants/<etudiantId> : retirer un étudiant de la classe.
  @Delete(':id/etudiants/:etudiantId')
  retirerEtudiant(
    @MembreCourant() membre: Membre,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('etudiantId', ParseUUIDPipe) etudiantId: string,
  ) {
    return this.service.retirerEtudiant(membre.etablissementId, id, etudiantId);
  }
}