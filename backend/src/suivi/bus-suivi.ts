import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';
import type { LigneJournal } from './types';

// Ce que le reste du serveur annonce à la passerelle du suivi.
export type EvenementSuivi =
  // Quelque chose a changé : pour un étudiant (participationId), ou pour toute l'évaluation.
  | { type: 'changement'; evaluationId: string; participationId?: string }
  // Un nouvel incident vient d'être écrit dans le journal.
  | { type: 'incident'; evaluationId: string; incident: LigneJournal };

// Le « bus » : un petit canal interne par lequel le passage et le suivi annoncent ce qui se
// passe, sans se connaître l'un l'autre. La passerelle écoute et prévient l'enseignant.
// Il garde aussi, en mémoire, la question affichée par chaque étudiant.
@Injectable()
export class BusSuivi {
  private readonly emetteur = new EventEmitter();

  // Numéro de la question affichée, par participation (valeur éphémère : en mémoire).
  private readonly questions = new Map<string, number>();

  publier(evenement: EvenementSuivi): void {
    this.emetteur.emit('evenement', evenement);
  }

  // Écoute les événements. Renvoie la fonction qui arrête l'écoute.
  ecouter(reaction: (evenement: EvenementSuivi) => void): () => void {
    this.emetteur.on('evenement', reaction);
    return () => {
      this.emetteur.off('evenement', reaction);
    };
  }

  noterQuestion(participationId: string, numero: number): void {
    this.questions.set(participationId, numero);
  }

  questionDe(participationId: string): number | null {
    return this.questions.get(participationId) ?? null;
  }
}