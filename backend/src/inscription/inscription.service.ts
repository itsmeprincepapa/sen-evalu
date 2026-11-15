import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Etablissement } from '../database/entities/etablissement.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import {
  StatutEtablissement,
  StatutEvaluation,
  StatutParticipation,
} from '../database/enums';
import { InscrireDto } from './dto/inscrire.dto';

// L'inscription des étudiants par le lien de l'évaluation.
// Ces routes sont PUBLIQUES (l'étudiant n'a pas de compte) : le lien aléatoire fait office
// de clé, et on ne révèle que le strict nécessaire.
@Injectable()
export class InscriptionService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Etablissement)
    private readonly etablissements: Repository<Etablissement>,
  ) {}

  // ---------------------------------------------------------------------------
  // INFOS : ce que l'étudiant voit en ouvrant le lien (titre, classes, inscriptions ouvertes ?).
  // ---------------------------------------------------------------------------
  async infos(lien: string) {
    const evaluation = await this.evaluationPublique(lien);
    return {
      titre: evaluation.titre,
      inscriptionsOuvertes: this.inscriptionsOuvertes(evaluation),
      classes: evaluation.classes
        .map((c) => ({ id: c.id, nom: c.nom }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    };
  }

  // ---------------------------------------------------------------------------
  // STATUT : où en est cette adresse e-mail pour cette évaluation ?
  // Le NOM n'est révélé qu'aux étudiants validés (ou déjà entrés).
  // ---------------------------------------------------------------------------
  async statut(lien: string, email: string) {
    const evaluation = await this.evaluationPublique(lien);
    const participation = await this.participations.findOneBy({
      evaluationId: evaluation.id,
      email: email.trim().toLowerCase(),
    });

    // Pas de demande pour cette adresse : on dit seulement si l'on peut en faire une.
    if (!participation) {
      return {
        statut: 'inconnu' as const,
        inscriptionsOuvertes: this.inscriptionsOuvertes(evaluation),
      };
    }

    const revelerLeNom =
      participation.statut === StatutParticipation.VALIDE ||
      participation.statut === StatutParticipation.EN_COURS;

    return {
      statut: participation.statut,
      ...(revelerLeNom
        ? { nom: participation.nom, prenom: participation.prenom }
        : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // INSCRIRE : l'étudiant envoie sa demande. Elle reste « en attente » jusqu'à ce que
  // l'enseignant la valide.
  // ---------------------------------------------------------------------------
  async inscrire(lien: string, dto: InscrireDto) {
    const evaluation = await this.evaluationPublique(lien);

    if (!this.inscriptionsOuvertes(evaluation)) {
      throw new ForbiddenException(
        'Les inscriptions sont fermées pour cette évaluation.',
      );
    }

    // La classe doit faire partie de CELLES de l'évaluation (pas n'importe laquelle).
    const classe = evaluation.classes.find((c) => c.id === dto.classeId);
    if (!classe) {
      throw new BadRequestException('Classe invalide.');
    }

    // Une adresse = une seule demande par évaluation.
    const email = dto.email.trim().toLowerCase();
    const existante = await this.participations.findOneBy({
      evaluationId: evaluation.id,
      email,
    });
    if (existante) {
      throw new ConflictException(
        'Une demande existe déjà avec cette adresse e-mail.',
      );
    }

    try {
      await this.participations.save(
        this.participations.create({
          evaluationId: evaluation.id,
          nom: dto.nom.trim(),
          prenom: dto.prenom.trim(),
          email,
          classeId: classe.id,
          statut: StatutParticipation.EN_ATTENTE,
        }),
      );
    } catch (erreur) {
      // Deux envois simultanés : l'index unique a refusé le second.
      if (this.estDoublon(erreur)) {
        throw new ConflictException(
          'Une demande existe déjà avec cette adresse e-mail.',
        );
      }
      throw erreur;
    }

    return { statut: StatutParticipation.EN_ATTENTE };
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Retrouve l'évaluation par son lien. On répond « lien inconnu » dans tous ces cas, sans
  // distinguer : lien faux, évaluation encore en brouillon, ou école désactivée.
  private async evaluationPublique(lien: string): Promise<Evaluation> {
    const evaluation = await this.evaluations.findOne({
      where: { lien },
      relations: { classes: true },
    });
    if (!evaluation || evaluation.statut === StatutEvaluation.BROUILLON) {
      throw new NotFoundException('Lien inconnu.');
    }

    const etablissement = await this.etablissements.findOneBy({
      id: evaluation.etablissementId,
    });
    if (etablissement?.statut !== StatutEtablissement.ACTIF) {
      throw new NotFoundException('Lien inconnu.');
    }
    return evaluation;
  }

  // Les inscriptions sont-elles ouvertes MAINTENANT ?
  private inscriptionsOuvertes(evaluation: Evaluation): boolean {
    // L'enseignant doit les avoir ouvertes...
    if (!evaluation.inscriptionsOuvertes) return false;
    // ... et leur date de fermeture ne doit pas être passée...
    if (
      evaluation.inscriptionsFermeLe &&
      evaluation.inscriptionsFermeLe.getTime() < Date.now()
    ) {
      return false;
    }
    // ... et l'évaluation ne doit pas être terminée.
    return (
      evaluation.fin.getTime() > Date.now() &&
      (evaluation.statut === StatutEvaluation.PLANIFIEE ||
        evaluation.statut === StatutEvaluation.EN_COURS)
    );
  }

  // Reconnaît l'erreur MySQL « entrée en double » (index unique violé).
  private estDoublon(erreur: unknown): boolean {
    const code = (erreur as { driverError?: { code?: string } })?.driverError
      ?.code;
    return code === 'ER_DUP_ENTRY';
  }
}