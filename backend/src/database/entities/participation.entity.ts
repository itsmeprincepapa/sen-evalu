import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntite } from '../base.entity';
import { StatutParticipation } from '../enums';
import { decimalEnNombre } from '../transformers';
import { Classe } from './classe.entity';
import { Etudiant } from './etudiant.entity';
import { Evaluation } from './evaluation.entity';

// Le passage d'UN étudiant dans UNE évaluation.
// La ligne est créée dès la demande d'inscription (statut « en attente »).
// Un e-mail ne peut s'inscrire qu'une fois par évaluation (index unique).
@Entity('participations')
@Index(['evaluationId', 'email'], { unique: true })
export class Participation extends BaseEntite {
  @Column('uuid')
  evaluationId!: string;

  @ManyToOne(() => Evaluation)
  @JoinColumn({ name: 'evaluationId' })
  evaluation!: Relation<Evaluation>;

  // --- Ce que l'étudiant a tapé en s'inscrivant ---
  @Column({ length: 100 })
  nom!: string;

  @Column({ length: 100 })
  prenom!: string;

  @Column({ length: 255 })
  email!: string;

  // Classe choisie dans la liste. SET NULL : si la classe disparaît, on garde la participation.
  @Column({ type: 'uuid', nullable: true })
  classeId!: string | null;

  @ManyToOne(() => Classe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'classeId' })
  classe!: Relation<Classe> | null;

  // La fiche Etudiant n'est rattachée qu'au moment de la validation par l'enseignant.
  @Column({ type: 'uuid', nullable: true })
  etudiantId!: string | null;

  @ManyToOne(() => Etudiant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'etudiantId' })
  etudiant!: Relation<Etudiant> | null;

  @Column({
    type: 'enum',
    enum: StatutParticipation,
    default: StatutParticipation.EN_ATTENTE,
  })
  statut!: StatutParticipation;

  // --- Le chronomètre : une DATE calculée par le serveur, pas un compteur ---
  // Heure à laquelle l'étudiant a commencé.
  @Column({ type: 'datetime', nullable: true })
  debutAt!: Date | null;

  // Heure de fin = le plus tôt entre « début + durée + temps supplémentaire »
  // et la fin de la plage horaire. Le temps restant = cette date moins l'heure du serveur.
  @Column({ type: 'datetime', nullable: true })
  finPrevueAt!: Date | null;

  // Temps ajouté par l'enseignant, en secondes.
  @Column({ type: 'int', default: 0 })
  tempsSupplementaireSecondes!: number;

  // --- Connexion et session unique ---
   // L'index accélère la recherche d'une session : elle est faite à CHAQUE requête d'un étudiant.
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId!: string | null;

  // Dernier signal reçu (sauvegarde ou « je suis là ») : sert à afficher « connecté » ou « coupé ».
  @Column({ type: 'datetime', nullable: true })
  derniereActiviteAt!: Date | null;

  // --- Anti-triche et résultat ---
  @Column({ type: 'int', default: 0 })
  nbIncidentsGraves!: number;

  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: decimalEnNombre,
  })
  noteTotale!: number | null;

  // Vrai quand l'enseignant a fini de corriger cette copie.
  @Column({ default: false })
  corrigee!: boolean;
}