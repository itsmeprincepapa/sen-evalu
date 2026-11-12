import { useEffect, useState } from 'react';
import { ErreurApi, lireEtat } from '../api/passage';
import { EcranFin } from '../components/EcranFin';
import { Epreuve } from '../components/Epreuve';
import { FormulaireEntree } from '../components/FormulaireEntree';
import type { MotifFin } from '../hooks/useSauvegardeAuto';
import { effacerCopie, lireCopie, type CopieLocale } from '../lib/copieLocale';
import type { Entree } from '../types';

// La page est toujours dans UNE de ces quatre « phases ».
type Phase =
  | { nom: 'chargement' }
  | { nom: 'entree' }
  | {
      nom: 'epreuve';
      entree: Entree;
      cleCopie: string;
      copieInitiale: CopieLocale;
    }
  | { nom: 'fin'; motif: MotifFin };

// --- La session de cet onglet (sessionStorage) ---
// Elle garde le jeton : au rechargement de la page (F5), on reprend sans retaper le code.
// Elle disparaît à la fermeture de l'onglet.
interface Session {
  lien: string;
  email: string;
  jeton: string;
}
const CLE_SESSION = 'sen-evalu:session';

function lireSession(lien: string): Session | null {
  try {
    const texte = sessionStorage.getItem(CLE_SESSION);
    if (!texte) return null;
    const session = JSON.parse(texte) as Session;
    return session.lien === lien ? session : null; // session d'une AUTRE évaluation : ignorée
  } catch {
    return null;
  }
}

function ecrireSession(session: Session): void {
  try {
    sessionStorage.setItem(CLE_SESSION, JSON.stringify(session));
  } catch {
    // Stockage bloqué : on continue, l'étudiant devra retaper son code après un rechargement.
  }
}

function effacerSession(): void {
  try {
    sessionStorage.removeItem(CLE_SESSION);
  } catch {
    // Rien à faire.
  }
}

// Lit le lien de l'évaluation dans l'adresse : « /e/<lien> ».
function lireLienDansAdresse(): string | null {
  const resultat = window.location.pathname.match(
    /^\/e\/([A-Za-z0-9_-]{4,40})\/?$/,
  );
  return resultat?.[1] ?? null;
}

// Prépare l'écran d'épreuve : on lit la copie locale de CET étudiant pour CETTE évaluation.
function versEpreuve(lien: string, entree: Entree, email: string): Phase {
  const cleCopie = `sen-evalu:copie:${lien}:${email.toLowerCase()}`;
  return {
    nom: 'epreuve',
    entree,
    cleCopie,
    copieInitiale: lireCopie(cleCopie),
  };
}

export function PagePassage() {
  const lien = lireLienDansAdresse();

  // Phase de départ : « chargement » si une session existe déjà (on tente de la reprendre),
  // sinon directement l'écran d'entrée.
  const [phase, setPhase] = useState<Phase>(() =>
    lien && lireSession(lien) ? { nom: 'chargement' } : { nom: 'entree' },
  );

  // REPRISE après un rechargement de la page : on redemande l'état au serveur.
  useEffect(() => {
    if (!lien) return;
    const session = lireSession(lien);
    if (!session) return;

    lireEtat(session.jeton)
      .then((etat) => {
        setPhase(
          versEpreuve(lien, { ...etat, jeton: session.jeton }, session.email),
        );
      })
      .catch((erreur: unknown) => {
        effacerSession();
        // Le temps est écoulé ou l'évaluation est terminée : écran de fin.
        if (
          erreur instanceof ErreurApi &&
          erreur.statut === 403 &&
          (erreur.code === 'TEMPS_ECOULE' || erreur.code === 'TERMINE')
        ) {
          setPhase({
            nom: 'fin',
            motif: erreur.code === 'TEMPS_ECOULE' ? 'temps' : 'termine',
          });
        } else {
          setPhase({ nom: 'entree' }); // session invalide ou serveur arrêté
        }
      });
  }, [lien]);

  if (!lien) {
    return (
      <p className="p-6">
        Lien invalide : l’adresse doit ressembler à
        http://localhost:5173/e/xxxxxxxxxxxxxxxx
      </p>
    );
  }

  if (phase.nom === 'chargement') {
    return <p className="p-6">Chargement…</p>;
  }

  if (phase.nom === 'entree') {
    return (
      <FormulaireEntree
        lien={lien}
        onEntree={(entree, email) => {
          ecrireSession({ lien, email, jeton: entree.jeton });
          setPhase(versEpreuve(lien, entree, email));
        }}
      />
    );
  }

  if (phase.nom === 'epreuve') {
    return (
      <Epreuve
        entree={phase.entree}
        cleCopie={phase.cleCopie}
        copieInitiale={phase.copieInitiale}
        onFin={(motif) => {
          effacerSession();
          // Sauf si la session a été remplacée par un autre onglet (qui en a encore besoin),
          // le serveur est la référence : on efface la copie locale.
          if (motif !== 'session') effacerCopie(phase.cleCopie);
          setPhase({ nom: 'fin', motif });
        }}
      />
    );
  }

  return <EcranFin motif={phase.motif} />;
}