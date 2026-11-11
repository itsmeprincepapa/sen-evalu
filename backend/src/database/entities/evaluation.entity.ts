import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { StatutEvaluation } from '../enums';
import { Classe } from './classe.entity';
import { Etablissement } from './etablissement.entity';
import { Membre } from './membre.entity';

// Une évaluation (contrôle, devoir, examen) créée par UN enseignant.
@Entity('evaluations')
export class Evaluation extends BaseEntite {
  @Column('uuid')
  etablissementId!: string;

  @ManyToOne(() => Etablissement)
  @JoinColumn({ name: 'etablissementId' })
  etablissement!: Relation<Etablissement>;

  // L'enseignant propriétaire : c'est un « Membre » (une personne dans UN établissement).
  @Column('uuid')
  membreId!: string;

  @ManyToOne(() => Membre)
  @JoinColumn({ name: 'membreId' })
  membre!: Relation<Membre>;

  @Column({ length: 200 })
  titre!: string;

  // Plage horaire pendant laquelle l'évaluation est accessible (en heure UTC).
  @Column({ type: 'datetime' })
  debut!: Date;

  @Column({ type: 'datetime' })
  fin!: Date;

  // Durée accordée à chaque étudiant, en minutes.
  @Column({ type: 'int' })
  dureeMinutes!: number;

  @Column({
    type: 'enum',
    enum: StatutEvaluation,
    default: StatutEvaluation.BROUILLON,
  })
  statut!: StatutEvaluation;

  // Code aléatoire placé dans l'adresse de l'évaluation (le « lien » à partager).
  // L'index unique garantit qu'il n'existe pas deux liens identiques.
  @Index({ unique: true })
  @Column({ length: 40 })
  lien!: string;

  // Les codes ne sont JAMAIS stockés en clair : on garde seulement leur empreinte (hash).
  // L'enseignant voit le code une seule fois, à la création, et peut le régénérer.
  @Column({ type: 'varchar', length: 100, nullable: true })
  codeAccesHash!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codeSortieHash!: string | null;

  // --- Inscriptions des étudiants ---
  // L'enseignant ouvre les inscriptions et peut fixer une date de fermeture.
  @Column({ default: false })
  inscriptionsOuvertes!: boolean;

  @Column({ type: 'datetime', nullable: true })
  inscriptionsFermeLe!: Date | null;

  // --- Options de l'évaluation ---
  @Column({ default: true })
  pleinEcranObligatoire!: boolean;

  @Column({ default: true })
  detecterChangementOnglet!: boolean;

  @Column({ default: false })
  melangerQuestions!: boolean;

  // Vrai : l'étudiant navigue librement. Faux : une question à la fois.
  @Column({ default: true })
  navigationLibre!: boolean;

  // Mode « une question à la fois » : le retour en arrière est-il permis ?
  @Column({ default: true })
  retourEnArriere!: boolean;

  // Une coupure plus courte que cette durée n'est pas signalée.
  @Column({ type: 'int', default: 60 })
  toleranceCoupureSecondes!: number;

  // Nombre d'incidents graves qui déclenche l'exclusion.
  @Column({ type: 'int', default: 2 })
  seuilIncidentsGraves!: number;

  // Les classes rattachées à l'évaluation (leurs étudiants s'inscrivent via le lien).
  // « JoinTable » crée la table de liaison « evaluations_classes ».
  @ManyToMany(() => Classe)
  @JoinTable({ name: 'evaluations_classes' })
  classes!: Classe[];
}