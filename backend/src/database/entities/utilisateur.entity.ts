import { Column, Entity } from 'typeorm';
import { BaseEntite } from '../base.entity';

// Une personne qui se connecte avec Google : enseignant, administrateur
// ou super-administrateur.
// Les ÉTUDIANTS ne sont pas ici : ils n'ont pas de compte (voir etudiant.entity.ts).
@Entity('utilisateurs')
export class Utilisateur extends BaseEntite {
  // L'adresse Google identifie la personne : elle doit être unique.
  @Column({ length: 255, unique: true })
  emailGoogle!: string;

  @Column({ length: 100 })
  nom!: string;

  @Column({ length: 100 })
  prenom!: string;

  // Vrai uniquement pour vous (le porteur du projet).
  // Cette valeur n'est liée à aucun établissement.
  @Column({ default: false })
  estSuperAdmin!: boolean;
}