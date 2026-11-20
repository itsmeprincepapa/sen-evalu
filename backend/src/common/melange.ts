// MÉLANGE « STABLE » : pour une même graine, on obtient TOUJOURS le même ordre.
// Chaque étudiant a sa propre graine (l'identifiant de sa participation) : son ordre est
// différent de celui des autres, mais il ne change jamais quand il recharge la page.

// Transforme un texte (la graine) en un nombre, avec l'algorithme « FNV-1a ».
function graineVersNombre(graine: string): number {
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Un petit générateur de nombres « au hasard » reproductible (algorithme « mulberry32 ») :
// avec la même graine, il donne toujours la même suite de nombres entre 0 et 1.
function generateur(graine: number): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Renvoie une COPIE de la liste, mélangée de façon stable selon la graine
// (méthode de Fisher-Yates). La liste d'origine n'est pas modifiée.
export function melangerStable<T>(elements: readonly T[], graine: string): T[] {
  const copie = [...elements];
  const hasard = generateur(graineVersNombre(graine));
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    const temporaire = copie[i];
    copie[i] = copie[j];
    copie[j] = temporaire;
  }
  return copie;
}