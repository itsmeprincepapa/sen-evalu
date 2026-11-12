import type { Contenu } from '../types';

// Copie des réponses gardée DANS LE NAVIGATEUR (localStorage) : elle survit à une
// coupure, à un rechargement de la page et même à la fermeture de l'onglet.
// Pour chaque question, on garde le contenu et son numéro de version.
export type CopieLocale = Record<string, { contenu: Contenu; version: number }>;

export function lireCopie(cle: string): CopieLocale {
  try {
    const texte = localStorage.getItem(cle);
    return texte ? (JSON.parse(texte) as CopieLocale) : {};
  } catch {
    return {}; // stockage bloqué ou contenu illisible : on repart de zéro
  }
}

export function ecrireCopie(cle: string, copie: CopieLocale): void {
  try {
    localStorage.setItem(cle, JSON.stringify(copie));
  } catch {
    // Stockage plein ou bloqué : on continue, le serveur reste la référence.
  }
}

export function effacerCopie(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    // Rien à faire.
  }
}