// Analyse d'une liste d'étudiants collée par l'enseignant (copiée d'Excel ou tapée).
// Une ligne = un étudiant, avec 3 colonnes : nom, prénom, e-mail.
// Les colonnes peuvent être séparées par une tabulation (copier-coller d'Excel),
// un point-virgule ou une virgule. La ligne d'en-tête (« Nom;Prénom;E-mail ») est ignorée.

export interface LigneValide {
  ligne: number; // numéro de la ligne dans le texte collé (la première est la ligne 1)
  nom: string;
  prenom: string;
  email: string; // en minuscules
}

export interface LigneErreur {
  ligne: number;
  contenu: string; // la ligne telle qu'elle a été collée
  raison: string;
}

export interface AnalyseListe {
  lignesLues: number;
  valides: LigneValide[];
  erreurs: LigneErreur[];
}

// Garde-fous : on refuse les listes démesurées.
const MAX_LIGNES = 500;
const LONGUEUR_MAX_NOM = 100;
const LONGUEUR_MAX_EMAIL = 255;

// Forme minimale d'une adresse : « quelquechose@domaine.extension », sans espace.
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function analyserListe(texte: string): AnalyseListe {
  const valides: LigneValide[] = [];
  const erreurs: LigneErreur[] = [];
  const dejaVus = new Set<string>(); // les e-mails déjà rencontrés dans ce texte
  let lignesLues = 0;
  let premiereLigne = true;
  let tropDeLignesSignale = false;

  texte.split(/\r?\n/).forEach((brute, index) => {
    const contenu = brute.trim();
    if (contenu === '') return; // les lignes vides sont ignorées
    const numero = index + 1;

    // Première ligne sans « @ » : c'est l'en-tête des colonnes, on la saute.
    if (premiereLigne) {
      premiereLigne = false;
      if (!contenu.includes('@')) return;
    }

    lignesLues++;
    if (lignesLues > MAX_LIGNES) {
      // On le signale UNE fois, puis on ignore le reste.
      if (!tropDeLignesSignale) {
        tropDeLignesSignale = true;
        erreurs.push({
          ligne: numero,
          contenu,
          raison: `Trop de lignes : ${MAX_LIGNES} au maximum par import.`,
        });
      }
      return;
    }

    // On découpe la ligne en colonnes (les cases vides d'Excel sont écartées).
    const colonnes = contenu
      .split(/[\t;,]/)
      .map((c) => c.trim())
      .filter((c) => c !== '');

    if (colonnes.length !== 3) {
      erreurs.push({
        ligne: numero,
        contenu,
        raison: `3 colonnes attendues (nom, prénom, e-mail), ${colonnes.length} trouvée(s).`,
      });
      return;
    }

    // L'e-mail est la colonne qui contient « @ » ; les deux autres sont le nom et le prénom.
    const placeEmail = colonnes.findIndex((c) => c.includes('@'));
    if (placeEmail === -1) {
      erreurs.push({ ligne: numero, contenu, raison: 'Aucune adresse e-mail trouvée.' });
      return;
    }
    const email = (colonnes[placeEmail] ?? '').toLowerCase();
    const [nom = '', prenom = ''] = colonnes.filter((_, k) => k !== placeEmail);

    if (!FORME_EMAIL.test(email) || email.length > LONGUEUR_MAX_EMAIL) {
      erreurs.push({ ligne: numero, contenu, raison: 'Adresse e-mail invalide.' });
      return;
    }
    if (nom.length > LONGUEUR_MAX_NOM || prenom.length > LONGUEUR_MAX_NOM) {
      erreurs.push({
        ligne: numero,
        contenu,
        raison: `Nom ou prénom trop long (${LONGUEUR_MAX_NOM} caractères au maximum).`,
      });
      return;
    }
    if (dejaVus.has(email)) {
      erreurs.push({
        ligne: numero,
        contenu,
        raison: 'Cette adresse est déjà présente plus haut dans la liste.',
      });
      return;
    }

    dejaVus.add(email);
    valides.push({ ligne: numero, nom, prenom, email });
  });

  return { lignesLues, valides, erreurs };
}