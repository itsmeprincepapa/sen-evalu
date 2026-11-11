import { ValueTransformer } from 'typeorm';

// Convertisseur utilisé pour les colonnes décimales (points, notes).
// Sans lui, une note de 12,5 reviendrait de la base sous la forme du texte "12.50".
export const decimalEnNombre: ValueTransformer = {
  // Vers la base : on envoie la valeur telle quelle.
  to: (valeur?: number | null) => valeur,
  // Depuis la base : on transforme le texte en nombre (ou null si vide).
  from: (valeur?: string | null) =>
    valeur === null || valeur === undefined ? null : parseFloat(valeur),
};