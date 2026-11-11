import { Classe } from './classe.entity';
import { Etablissement } from './etablissement.entity';
import { EnvoiNote } from './envoi-note.entity';
import { Etudiant } from './etudiant.entity';
import { Evaluation } from './evaluation.entity';
import { Incident } from './incident.entity';
import { Membre } from './membre.entity';
import { Participation } from './participation.entity';
import { Question } from './question.entity';
import { Reponse } from './reponse.entity';
import { Utilisateur } from './utilisateur.entity';

// Liste de TOUTES les entités. Elle sert à l'application et à la commande
// des migrations. À chaque nouvelle entité, on l'ajoute ici.
export const toutesLesEntites = [
  Etablissement,
  Utilisateur,
  Membre,
  Etudiant,
  Classe,
  Evaluation,
  Participation,
  Question,
  Reponse,
  Incident,
  EnvoiNote,
];