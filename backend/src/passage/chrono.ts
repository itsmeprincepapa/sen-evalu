// Heure de fin d'un étudiant = le plus tôt entre « début + durée + temps supplémentaire »
// et la fin de la plage horaire de l'évaluation.
// (Fonction partagée par le passage et par le suivi de l'enseignant.)
export function calculerFinPrevue(
  debut: Date,
  dureeMinutes: number,
  tempsSupplementaireSecondes: number,
  finPlage: Date,
): Date {
  const finParDuree =
    debut.getTime() + dureeMinutes * 60_000 + tempsSupplementaireSecondes * 1000;
  return new Date(Math.min(finParDuree, finPlage.getTime()));
}