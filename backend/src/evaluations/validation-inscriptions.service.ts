import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Classe } from '../database/entities/classe.entity';
import { Etudiant } from '../database/entities/etudiant.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Membre } from '../database/entities/membre.entity';
import { Participation } from '../database/entities/participation.entity';
import { StatutEvaluation, StatutParticipation } from '../database/enums';
import { ChoixInscriptionsDto } from './dto/choix-inscriptions.dto';
import { CorrigerInscriptionDto } from './dto/corriger-inscription.dto';

// La validation des demandes d'inscription par l'enseignant propriétaire de l'évaluation.
@Injectable()
export class ValidationInscriptionsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
  ) {}

  // ---------------------------------------------------------------------------
  // LISTER toutes les demandes de l'évaluation (tous états confondus).
  // ---------------------------------------------------------------------------
  async lister(membre: Membre, evaluationId: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    const demandes = await this.participations.find({
      where: { evaluationId: evaluation.id },
      relations: { classe: true },
      order: { creeLe: 'ASC' },
    });

    return demandes.map((p) => ({
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      email: p.email,
      statut: p.statut,
      classe: p.classe ? { id: p.classe.id, nom: p.classe.nom } : null,
      demandeLe: p.creeLe,
    }));
  }

  // ---------------------------------------------------------------------------
  // VALIDER des demandes : la sélection (ids), ou toutes celles en attente (tous).
  // Pour chaque demande validée, l'étudiant est enregistré dans l'établissement
  // et ajouté à la classe qu'il a choisie.
  // ---------------------------------------------------------------------------
  async valider(membre: Membre, evaluationId: string, choix: ChoixInscriptionsDto) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    this.verifierModifiable(evaluation);

    if (!choix.tous && (!choix.ids || choix.ids.length === 0)) {
      throw new BadRequestException('Aucune demande sélectionnée.');
    }

    // « Tout valider » ne prend que les demandes en attente ; une sélection peut aussi
    // contenir des demandes refusées (l'enseignant change d'avis).
    const aValider = await this.participations.find({
      where: choix.tous
        ? { evaluationId: evaluation.id, statut: StatutParticipation.EN_ATTENTE }
        : {
            evaluationId: evaluation.id,
            id: In(choix.ids ?? []),
            statut: In([StatutParticipation.EN_ATTENTE, StatutParticipation.REFUSE]),
          },
    });
    if (aValider.length === 0) return { valides: 0 };

    // Tout se fait en UNE opération : tout réussit, ou rien n'est enregistré.
    await this.participations.manager.transaction(async (gestionnaire) => {
      // Pour chaque classe, les étudiants à y ajouter.
      const parClasse = new Map<string, Set<string>>();

      for (const demande of aValider) {
        // La fiche de l'étudiant dans l'établissement : on la retrouve, ou on la crée.
        let etudiant = await gestionnaire.findOneBy(Etudiant, {
          etablissementId: membre.etablissementId,
          email: demande.email,
        });
        if (!etudiant) {
          etudiant = await gestionnaire.save(
            gestionnaire.create(Etudiant, {
              etablissementId: membre.etablissementId,
              nom: demande.nom,
              prenom: demande.prenom,
              email: demande.email,
            }),
          );
        }

        demande.etudiantId = etudiant.id;
        demande.statut = StatutParticipation.VALIDE;
        await gestionnaire.save(demande);

        if (demande.classeId) {
          const ensemble = parClasse.get(demande.classeId) ?? new Set<string>();
          ensemble.add(etudiant.id);
          parClasse.set(demande.classeId, ensemble);
        }
      }

      // Classe par classe : on ajoute seulement ceux qui n'y sont pas déjà.
      for (const [classeId, etudiantIds] of parClasse) {
        const dejaMembres = await gestionnaire
          .createQueryBuilder()
          .relation(Classe, 'etudiants')
          .of(classeId)
          .loadMany<Etudiant>();
        const dejaIds = new Set(dejaMembres.map((e) => e.id));
        const manquants = [...etudiantIds].filter((id) => !dejaIds.has(id));
        if (manquants.length > 0) {
          await gestionnaire
            .createQueryBuilder()
            .relation(Classe, 'etudiants')
            .of(classeId)
            .add(manquants);
        }
      }
    });

    return { valides: aValider.length };
  }

  // ---------------------------------------------------------------------------
  // REFUSER des demandes (en attente, ou validées mais pas encore commencées).
  // ---------------------------------------------------------------------------
  async refuser(membre: Membre, evaluationId: string, ids: string[]) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    this.verifierModifiable(evaluation);

    if (ids.length === 0) {
      throw new BadRequestException('Aucune demande sélectionnée.');
    }

    // On ne touche pas à un étudiant déjà entré, exclu ou terminé.
    const resultat = await this.participations.update(
      {
        evaluationId: evaluation.id,
        id: In(ids),
        statut: In([StatutParticipation.EN_ATTENTE, StatutParticipation.VALIDE]),
      },
      { statut: StatutParticipation.REFUSE },
    );
    return { refuses: resultat.affected ?? 0 };
  }

  // ---------------------------------------------------------------------------
  // CORRIGER une demande avant de la valider (faute de frappe dans l'e-mail ou le nom).
  // ---------------------------------------------------------------------------
  async corriger(
    membre: Membre,
    evaluationId: string,
    participationId: string,
    dto: CorrigerInscriptionDto,
  ) {
    const evaluation = await this.evaluationDuProprietaire(membre, evaluationId);
    this.verifierModifiable(evaluation);

    const demande = await this.participations.findOneBy({
      id: participationId,
      evaluationId: evaluation.id,
    });
    if (!demande) throw new NotFoundException('Demande introuvable.');

    // Une demande déjà validée ne se corrige plus (l'étudiant a peut-être déjà vu son nom).
    if (
      demande.statut !== StatutParticipation.EN_ATTENTE &&
      demande.statut !== StatutParticipation.REFUSE
    ) {
      throw new ConflictException(
        'Seules les demandes non validées peuvent être corrigées.',
      );
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== demande.email) {
        // Une adresse = une seule demande par évaluation.
        const autre = await this.participations.findOneBy({
          evaluationId: evaluation.id,
          email,
        });
        if (autre) {
          throw new ConflictException(
            'Une autre demande utilise déjà cette adresse e-mail.',
          );
        }
        demande.email = email;
      }
    }
    if (dto.nom !== undefined) demande.nom = dto.nom.trim();
    if (dto.prenom !== undefined) demande.prenom = dto.prenom.trim();

    await this.participations.save(demande);
    return {
      id: demande.id,
      nom: demande.nom,
      prenom: demande.prenom,
      email: demande.email,
    };
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Retrouve l'évaluation SEULEMENT si elle appartient à CET enseignant, dans CET
  // établissement. Sinon : « introuvable » (on ne révèle pas l'existence des évaluations
  // des autres).
  private async evaluationDuProprietaire(
    membre: Membre,
    evaluationId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluations.findOneBy({
      id: evaluationId,
      etablissementId: membre.etablissementId,
      membreId: membre.id,
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable.');
    return evaluation;
  }

  // On ne modifie plus les inscriptions d'une évaluation terminée.
  private verifierModifiable(evaluation: Evaluation): void {
    if (
      evaluation.statut !== StatutEvaluation.PLANIFIEE &&
      evaluation.statut !== StatutEvaluation.EN_COURS
    ) {
      throw new ForbiddenException(
        'Les inscriptions de cette évaluation ne peuvent plus être modifiées.',
      );
    }
  }
}