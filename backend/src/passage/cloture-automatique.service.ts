import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from '../database/entities/evaluation.entity';
import { Participation } from '../database/entities/participation.entity';
import { StatutEvaluation, StatutParticipation } from '../database/enums';
import { INTERVALLE_CLOTURE_MS, MARGE_FIN_SECONDES } from './constantes';

// Tâche qui tourne TOUTE SEULE sur le serveur, même si plus personne n'est connecté.
// Elle termine ce dont l'heure de fin est dépassée.
@Injectable()
export class ClotureAutomatiqueService {
  private readonly logger = new Logger(ClotureAutomatiqueService.name);

  // Évite que deux vérifications se chevauchent si l'une d'elles est lente.
  private enCours = false;

  constructor(
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectRepository(Evaluation)
    private readonly evaluations: Repository<Evaluation>,
  ) {}

  // « @Interval » : cette méthode s'exécute toutes les 30 secondes.
  @Interval(INTERVALLE_CLOTURE_MS)
  async cloturerCeQuiEstEcoule(): Promise<void> {
    if (this.enCours) return;
    this.enCours = true;

    try {
      // Tout ce qui devait finir AVANT cet instant est écoulé (marge comprise).
      const limite = new Date(Date.now() - MARGE_FIN_SECONDES * 1000);

      // 1. Participations « en cours » dont l'heure de fin est dépassée.
      // Les étudiants EXCLUS ne sont pas touchés : l'exclusion reste définitive.
      // Les étudiants validés qui ne sont jamais entrés (absents) ne le sont pas non plus.
      const participations = await this.participations
        .createQueryBuilder()
        .update()
        .set({ statut: StatutParticipation.TERMINE })
        .where('statut = :statut', { statut: StatutParticipation.EN_COURS })
        .andWhere('finPrevueAt < :limite', { limite })
        .execute();

      // 2. Évaluations dont la plage horaire est terminée.
      // (À l'étape 9, c'est à cette occasion que les QCM seront corrigés.)
      const evaluations = await this.evaluations
        .createQueryBuilder()
        .update()
        .set({ statut: StatutEvaluation.TERMINEE })
        .where('statut IN (:...statuts)', {
          statuts: [StatutEvaluation.PLANIFIEE, StatutEvaluation.EN_COURS],
        })
        .andWhere('fin < :limite', { limite })
        .execute();

      // On n'écrit dans le terminal que lorsqu'il s'est passé quelque chose.
      if ((participations.affected ?? 0) > 0) {
        this.logger.log(
          `${participations.affected} participation(s) clôturée(s) : temps écoulé`,
        );
      }
      if ((evaluations.affected ?? 0) > 0) {
        this.logger.log(
          `${evaluations.affected} évaluation(s) terminée(s) : plage horaire finie`,
        );
      }
    } catch (erreur) {
      // Une erreur ne doit jamais arrêter le serveur : on l'écrit, et on réessaie au prochain tour.
      this.logger.error(
        'Échec de la clôture automatique',
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
    } finally {
      this.enCours = false;
    }
  }
}