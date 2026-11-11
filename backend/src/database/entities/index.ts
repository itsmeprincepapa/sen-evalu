import { Classe } from './classe.entity';
import { Etablissement } from './etablissement.entity';
import { Etudiant } from './etudiant.entity';
import { Membre } from './membre.entity';
import { Utilisateur } from './utilisateur.entity';

// Liste de TOUTES les entités. Elle sert à l'application et à la commande
// des migrations. À chaque nouvelle entité, on l'ajoute ici.
export const toutesLesEntites = [
  Etablissement,
  Utilisateur,
  Membre,
  Etudiant,
  Classe,
];