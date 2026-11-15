import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Membre } from '../database/entities/membre.entity';
import { Participation } from '../database/entities/participation.entity';

// Les évaluations de l'enseignant. (L'étape 6 y ajoutera la création et la modification.)
@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
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