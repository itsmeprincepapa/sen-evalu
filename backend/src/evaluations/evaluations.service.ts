import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { genererCode, hasherCode, verifierCode } from '../common/codes';
import { Classe } from '../database/entities/classe.entity';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Membre } from '../database/entities/membre.entity';
import { Participation } from '../database/entities/participation.entity';
import { Question } from '../database/entities/question.entity';
import { StatutEvaluation, StatutParticipation } from '../database/enums';import { CreerEvaluationDto } from './dto/creer-evaluation.dto';
import { DefinirCodeDto } from './dto/definir-code.dto';
import { ModifierEvaluationDto } from './dto/modifier-evaluation.dto';

// Nombre d'essais pour trouver un lien aléatoire encore libre (le cas est très rare).
const ESSAIS_LIEN = 5;

// Les champs qui ne peuvent pas être « vides » (null) dans une modification.
const CHAMPS_NON_NULS = [
  'titre',
  'debut',
  'fin',
  'dureeMinutes',
  'classeIds',
  'inscriptionsOuvertes',
  'pleinEcranObligatoire',
  'detecterChangementOnglet',
  'melangerQuestions',
  'navigationLibre',
  'retourEnArriere',
  'toleranceCoupureSecondes',
  'seuilIncidentsGraves',
] as const;

// Les évaluations de l'enseignant : liste, création, modification, suppression, codes.
@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
    @InjectRepository(Classe)
    private readonly classes: Repository<Classe>,
  ) {}

  // MES ÉVALUATIONS : celles de CET enseignant, dans CET établissement, avec le nombre
  // de demandes pour chaque état (en attente, validées...).
  async listerMesEvaluations(membre: Membre) {
    const liste = await this.evaluations.find({
      where: { membreId: membre.id, etablissementId: membre.etablissementId },
      order: { creeLe: 'DESC' },
    });
    const comptes = await this.compterParStatut(liste.map((e) => e.id));

    return liste.map((e) => ({
      id: e.id,
      titre: e.titre,
      statut: e.statut,
      debut: e.debut,
      fin: e.fin,
      lien: e.lien,
      inscriptionsOuvertes: e.inscriptionsOuvertes,
      comptes: comptes.get(e.id) ?? {},
    }));
  }

  // ---------------------------------------------------------------------------
  // CRÉER un brouillon. Le lien aléatoire est généré ici ; les codes viennent après.
  // ---------------------------------------------------------------------------
  async creer(membre: Membre, dto: CreerEvaluationDto) {
    const debut = new Date(dto.debut);
    const fin = new Date(dto.fin);
    this.verifierPlage(debut, fin, dto.dureeMinutes);

    const classes = await this.retrouverClasses(
      membre.etablissementId,
      dto.classeIds ?? [],
    );

    // Le lien est tiré au hasard. S'il existe déjà (probabilité quasi nulle),
    // l'index unique refuse l'enregistrement : on retente avec un autre lien.
    for (let essai = 1; essai <= ESSAIS_LIEN; essai++) {
      const evaluation = this.evaluations.create({
        etablissementId: membre.etablissementId,
        membreId: membre.id,
        titre: dto.titre.trim(),
        debut,
        fin,
        dureeMinutes: dto.dureeMinutes,
        statut: StatutEvaluation.BROUILLON,
        lien: randomBytes(8).toString('hex'), // 16 caractères hexadécimaux
        classes,
      });
      try {
        const enregistree = await this.evaluations.save(evaluation);
        return this.detail(membre, enregistree.id);
      } catch (erreur) {
        if (!this.estDoublon(erreur) || essai === ESSAIS_LIEN) throw erreur;
      }
    }
    // Inatteignable : la boucle renvoie ou lève toujours une erreur.
    throw new ConflictException('Impossible de générer un lien.');
  }

  // ---------------------------------------------------------------------------
  // DÉTAIL pour l'écran d'édition. Ne renvoie JAMAIS un code, seulement s'il est défini.
  // ---------------------------------------------------------------------------
  async detail(membre: Membre, id: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, id, true);
    const [nombreQuestions, nombreInscriptions] = await Promise.all([
      this.questions.countBy({ evaluationId: evaluation.id }),
      this.participations.countBy({ evaluationId: evaluation.id }),
    ]);

    return {
      id: evaluation.id,
      titre: evaluation.titre,
      statut: evaluation.statut,
      debut: evaluation.debut,
      fin: evaluation.fin,
      dureeMinutes: evaluation.dureeMinutes,
      lien: evaluation.lien,
      inscriptionsOuvertes: evaluation.inscriptionsOuvertes,
      inscriptionsFermeLe: evaluation.inscriptionsFermeLe,
      options: {
        pleinEcranObligatoire: evaluation.pleinEcranObligatoire,
        detecterChangementOnglet: evaluation.detecterChangementOnglet,
        melangerQuestions: evaluation.melangerQuestions,
        navigationLibre: evaluation.navigationLibre,
        retourEnArriere: evaluation.retourEnArriere,
        toleranceCoupureSecondes: evaluation.toleranceCoupureSecondes,
        seuilIncidentsGraves: evaluation.seuilIncidentsGraves,
      },
      classes: (evaluation.classes ?? []).map((c) => ({ id: c.id, nom: c.nom })),
      codeAccesDefini: evaluation.codeAccesHash !== null,
      codeSortieDefini: evaluation.codeSortieHash !== null,
      nombreQuestions,
      nombreInscriptions,
      modifiable: this.estModifiable(evaluation),
    };
  }

  // ---------------------------------------------------------------------------
  // MODIFIER : on n'envoie que ce qui change.
  // - Brouillon ou planifiée : tout est modifiable.
  // - Ensuite (en cours...) : seules les inscriptions (ouverture, date de fermeture).
  // ---------------------------------------------------------------------------
  async modifier(membre: Membre, id: string, dto: ModifierEvaluationDto) {
    // Un champ obligatoire ne peut pas être vidé (seule la date de fermeture le peut).
    for (const cle of CHAMPS_NON_NULS) {
      if (dto[cle] === null) {
        throw new BadRequestException(`Le champ « ${cle} » ne peut pas être vide.`);
      }
    }

    const evaluation = await this.evaluationDuProprietaire(membre, id, true);

    // Les champs « de fond » : tout sauf les deux réglages d'inscription.
    const toucheLeFond = [
      dto.titre,
      dto.debut,
      dto.fin,
      dto.dureeMinutes,
      dto.classeIds,
      dto.pleinEcranObligatoire,
      dto.detecterChangementOnglet,
      dto.melangerQuestions,
      dto.navigationLibre,
      dto.retourEnArriere,
      dto.toleranceCoupureSecondes,
      dto.seuilIncidentsGraves,
    ].some((valeur) => valeur !== undefined);

    if (toucheLeFond && !this.estModifiable(evaluation)) {
      throw new ForbiddenException(
        'Cette évaluation ne peut plus être modifiée (seules les inscriptions le peuvent).',
      );
    }

    // Les inscriptions restent modifiables jusqu'à ce que l'évaluation soit terminée.
    const inscriptionsModifiables =
      this.estModifiable(evaluation) ||
      evaluation.statut === StatutEvaluation.EN_COURS;
    if (
      (dto.inscriptionsOuvertes !== undefined ||
        dto.inscriptionsFermeLe !== undefined) &&
      !inscriptionsModifiables
    ) {
      throw new ForbiddenException(
        'Les inscriptions de cette évaluation ne peuvent plus être modifiées.',
      );
    }

    // --- Plage horaire et durée : on contrôle l'ENSEMBLE (nouvelles valeurs + anciennes) ---
    const debut = dto.debut !== undefined ? new Date(dto.debut) : evaluation.debut;
    const fin = dto.fin !== undefined ? new Date(dto.fin) : evaluation.fin;
    const duree = dto.dureeMinutes ?? evaluation.dureeMinutes;
    this.verifierPlage(debut, fin, duree);

    if (dto.classeIds !== undefined) {
      evaluation.classes = await this.retrouverClasses(
        membre.etablissementId,
        dto.classeIds,
      );
    }

    // --- On applique chaque champ envoyé ---
    if (dto.titre !== undefined) evaluation.titre = dto.titre.trim();
    evaluation.debut = debut;
    evaluation.fin = fin;
    evaluation.dureeMinutes = duree;

    if (dto.inscriptionsOuvertes !== undefined) {
      evaluation.inscriptionsOuvertes = dto.inscriptionsOuvertes;
    }
    if (dto.inscriptionsFermeLe !== undefined) {
      // « null » efface la date de fermeture.
      evaluation.inscriptionsFermeLe =
        dto.inscriptionsFermeLe === null ? null : new Date(dto.inscriptionsFermeLe);
    }

    if (dto.pleinEcranObligatoire !== undefined) {
      evaluation.pleinEcranObligatoire = dto.pleinEcranObligatoire;
    }
    if (dto.detecterChangementOnglet !== undefined) {
      evaluation.detecterChangementOnglet = dto.detecterChangementOnglet;
    }
    if (dto.melangerQuestions !== undefined) {
      evaluation.melangerQuestions = dto.melangerQuestions;
    }
    if (dto.navigationLibre !== undefined) {
      evaluation.navigationLibre = dto.navigationLibre;
    }
    if (dto.retourEnArriere !== undefined) {
      evaluation.retourEnArriere = dto.retourEnArriere;
    }
    if (dto.toleranceCoupureSecondes !== undefined) {
      evaluation.toleranceCoupureSecondes = dto.toleranceCoupureSecondes;
    }
    if (dto.seuilIncidentsGraves !== undefined) {
      evaluation.seuilIncidentsGraves = dto.seuilIncidentsGraves;
    }

    // « save » met aussi à jour la liste des classes (table evaluations_classes).
    await this.evaluations.save(evaluation);
    return this.detail(membre, evaluation.id);
  }

  // ---------------------------------------------------------------------------
  // SUPPRIMER : un brouillon SANS aucune inscription seulement.
  // Les questions et les classes rattachées partent avec lui (suppression en cascade).
  // ---------------------------------------------------------------------------
  async supprimer(membre: Membre, id: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, id);
    if (evaluation.statut !== StatutEvaluation.BROUILLON) {
      throw new ConflictException('Seul un brouillon peut être supprimé.');
    }
    const inscriptions = await this.participations.countBy({
      evaluationId: evaluation.id,
    });
    if (inscriptions > 0) {
      throw new ConflictException(
        'Ce brouillon a déjà des inscriptions : il ne peut pas être supprimé.',
      );
    }
    await this.evaluations.delete(evaluation.id);
    return { supprimee: true };
  }

  // ---------------------------------------------------------------------------
  // CODES : génère un code de 6 chiffres, ou prend celui choisi par l'enseignant.
  // Le code est haché puis renvoyé UNE SEULE FOIS : on ne pourra plus jamais le relire.
  // ---------------------------------------------------------------------------
  async definirCode(
    membre: Membre,
    id: string,
    quel: 'acces' | 'sortie',
    dto: DefinirCodeDto,
  ) {
    const evaluation = await this.evaluationDuProprietaire(membre, id);
    if (!this.estModifiable(evaluation)) {
      throw new ForbiddenException(
        'Les codes ne peuvent plus être changés une fois l’évaluation commencée.',
      );
    }

    // L'AUTRE code : le nouveau doit être différent de celui-là.
    const hashAutre =
      quel === 'acces' ? evaluation.codeSortieHash : evaluation.codeAccesHash;

    let code: string;
    if (dto.code) {
      // Code choisi : on le normalise comme le fera le passage (trim + majuscules).
      code = dto.code.trim().toUpperCase();
      if (await verifierCode(code, hashAutre)) {
        throw new ConflictException(
          'Le code d’accès et le code de sortie doivent être différents.',
        );
      }
    } else {
      // Code généré : s'il tombait sur l'autre code (1 chance sur un million), on retire.
      code = genererCode();
      for (let essai = 1; essai < ESSAIS_LIEN; essai++) {
        if (!(await verifierCode(code, hashAutre))) break;
        code = genererCode();
      }
    }

    const hash = await hasherCode(code);
    await this.evaluations.update(
      evaluation.id,
      quel === 'acces' ? { codeAccesHash: hash } : { codeSortieHash: hash },
    );
    return { code };
  }
    // ---------------------------------------------------------------------------
  // PLANIFIER : le brouillon devient « planifiée » (le lien s'ouvre aux étudiants).
  // On vérifie d'abord que tout est en place ; sinon on renvoie ce qui manque.
  // ---------------------------------------------------------------------------
  async planifier(membre: Membre, id: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, id, true);
    if (evaluation.statut !== StatutEvaluation.BROUILLON) {
      throw new ConflictException('Seul un brouillon peut être planifié.');
    }

    // On liste TOUT ce qui manque, pour que l'enseignant le corrige en une fois.
    const manques: string[] = [];
    const nombreQuestions = await this.questions.countBy({
      evaluationId: evaluation.id,
    });
    if (nombreQuestions === 0) manques.push('Ajoutez au moins une question.');
    if (evaluation.codeAccesHash === null) {
      manques.push('Définissez le code d’accès.');
    }
    if (evaluation.codeSortieHash === null) {
      manques.push('Définissez le code de sortie.');
    }
    if ((evaluation.classes ?? []).length === 0) {
      manques.push('Rattachez au moins une classe.');
    }
    if (evaluation.fin.getTime() <= Date.now()) {
      manques.push('La fin de la plage horaire est déjà passée.');
    }
    if (manques.length > 0) throw new BadRequestException(manques);

    await this.evaluations.update(evaluation.id, {
      statut: StatutEvaluation.PLANIFIEE,
    });
    return this.detail(membre, evaluation.id);
  }

  // ---------------------------------------------------------------------------
  // REPASSER EN BROUILLON : possible seulement tant qu'aucun étudiant n'est entré.
  // Les inscriptions déjà faites sont conservées ; le lien est simplement refermé.
  // ---------------------------------------------------------------------------
  async repasserEnBrouillon(membre: Membre, id: string) {
    const evaluation = await this.evaluationDuProprietaire(membre, id);
    if (evaluation.statut !== StatutEvaluation.PLANIFIEE) {
      throw new ConflictException(
        'Seule une évaluation planifiée peut repasser en brouillon.',
      );
    }

    // « Entré » = en cours, exclu ou terminé (un étudiant a commencé à composer).
    const entres = await this.participations.countBy({
      evaluationId: evaluation.id,
      statut: In([
        StatutParticipation.EN_COURS,
        StatutParticipation.EXCLU,
        StatutParticipation.TERMINE,
      ]),
    });
    if (entres > 0) {
      throw new ConflictException(
        'Un étudiant est déjà entré : l’évaluation ne peut plus repasser en brouillon.',
      );
    }

    await this.evaluations.update(evaluation.id, {
      statut: StatutEvaluation.BROUILLON,
    });
    return this.detail(membre, evaluation.id);
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Retrouve l'évaluation SEULEMENT si elle appartient à CET enseignant, dans CET
  // établissement. Sinon : « introuvable » (on ne révèle pas celles des autres).
  private async evaluationDuProprietaire(
    membre: Membre,
    id: string,
    avecClasses = false,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluations.findOne({
      where: {
        id,
        etablissementId: membre.etablissementId,
        membreId: membre.id,
      },
      relations: { classes: avecClasses },
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable.');
    return evaluation;
  }

  // Le fond d'une évaluation ne se modifie qu'en brouillon ou planifiée.
  private estModifiable(evaluation: Evaluation): boolean {
    return (
      evaluation.statut === StatutEvaluation.BROUILLON ||
      evaluation.statut === StatutEvaluation.PLANIFIEE
    );
  }

  // Règles de la plage : fin après début, et durée qui tient dans la plage.
  private verifierPlage(debut: Date, fin: Date, dureeMinutes: number): void {
    if (fin.getTime() <= debut.getTime()) {
      throw new BadRequestException('La fin doit être après le début.');
    }
    const plageMinutes = (fin.getTime() - debut.getTime()) / 60_000;
    if (dureeMinutes > plageMinutes) {
      throw new BadRequestException(
        'La durée dépasse la plage horaire de l’évaluation.',
      );
    }
  }

  // Retrouve les classes demandées, en n'acceptant que celles de l'ÉTABLISSEMENT.
  // Une classe d'une autre école est traitée comme inconnue.
  private async retrouverClasses(
    etablissementId: string,
    ids: string[],
  ): Promise<Classe[]> {
    const uniques = [...new Set(ids)];
    if (uniques.length === 0) return [];
    const trouvees = await this.classes.findBy({
      id: In(uniques),
      etablissementId,
    });
    if (trouvees.length !== uniques.length) {
      throw new BadRequestException('Une des classes est inconnue.');
    }
    return trouvees;
  }

  // Reconnaît l'erreur MySQL « entrée en double » (index unique violé).
  private estDoublon(erreur: unknown): boolean {
    const code = (erreur as { driverError?: { code?: string } })?.driverError
      ?.code;
    return code === 'ER_DUP_ENTRY';
  }

  // Compte les participations de chaque évaluation, état par état.
  // Résultat : pour chaque évaluation, par exemple { en_attente: 3, valide: 12 }.
  private async compterParStatut(
    ids: string[],
  ): Promise<Map<string, Record<string, number>>> {
    const resultat = new Map<string, Record<string, number>>();
    if (ids.length === 0) return resultat;

    const lignes = await this.participations
      .createQueryBuilder('p')
      .select('p.evaluationId', 'evaluationId')
      .addSelect('p.statut', 'statut')
      .addSelect('COUNT(*)', 'n')
      .where('p.evaluationId IN (:...ids)', { ids })
      .groupBy('p.evaluationId')
      .addGroupBy('p.statut')
      .getRawMany<{ evaluationId: string; statut: string; n: string }>();

    for (const ligne of lignes) {
      const compte = resultat.get(ligne.evaluationId) ?? {};
      compte[ligne.statut] = Number(ligne.n);
      resultat.set(ligne.evaluationId, compte);
    }
    return resultat;
  }
}