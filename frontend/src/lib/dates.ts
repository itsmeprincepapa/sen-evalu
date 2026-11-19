// Les champs « date et heure » du navigateur donnent un texte comme « 2026-12-01T09:00 »,
// SANS fuseau : c'est l'heure locale de la personne. Le serveur, lui, veut de l'UTC.
// Ces deux fonctions font la conversion dans les deux sens.

// Heure locale saisie -> date UTC au format ISO (ex. « 2026-12-01T09:00:00.000Z »).
// Renvoie null si le champ est vide ou invalide.
export function dateLocaleVersUtc(valeur: string): string | null {
  if (valeur === '') return null;
  const date = new Date(valeur); // ce texte sans fuseau est lu comme une heure LOCALE
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Date UTC du serveur -> texte pour le champ « date et heure » (en heure locale).
export function utcVersDateLocale(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}` +
    `T${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`
  );
}