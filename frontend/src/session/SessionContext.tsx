import { googleLogout } from '@react-oauth/google';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { connexionGoogle, moi } from '../api/auth';
import { ErreurReseau } from '../api/http';
import type { Profil, Rattachement } from '../types';

// Où est rangée la session : « sessionStorage » est propre à l'onglet et disparaît à sa
// fermeture (c'est plus prudent sur un ordinateur partagé qu'un stockage permanent).
const CLE_JETON = 'sen-evalu:jeton';
// L'établissement choisi par la personne (rangé au même endroit).
const CLE_ETABLISSEMENT = 'sen-evalu:etablissement';

function lire(cle: string): string | null {
  try {
    return sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrire(cle: string, valeur: string): void {
  try {
    sessionStorage.setItem(cle, valeur);
  } catch {
    // Stockage bloqué : la personne devra se reconnecter après un rechargement.
  }
}
function effacer(cle: string): void {
  try {
    sessionStorage.removeItem(cle);
  } catch {
    // Rien à faire.
  }
}

// chargement   : on vérifie auprès du serveur une session trouvée dans l'onglet
// connecte     : la personne est connectée, son profil est connu
// deconnecte   : pas de session (ou session refusée)
// indisponible : serveur injoignable pendant la vérification
type EtatSession = 'chargement' | 'connecte' | 'deconnecte' | 'indisponible';

interface ContexteSession {
  etat: EtatSession;
  jeton: string | null;
  profil: Profil | null;
  // L'établissement dans lequel la personne travaille en ce moment (parmi ses
  // établissements ACTIFS) ; null si elle n'en a aucun.
  etablissementActif: Rattachement | null;
  choisirEtablissement: (etablissementId: string) => void;
  connecter: (credential: string) => Promise<void>;
  deconnecter: () => void;
  recharger: () => void;
}

const Contexte = createContext<ContexteSession | null>(null);

// À placer autour de toute l'application : il fournit la session à tous les écrans.
export function FournisseurSession({ children }: { children: ReactNode }) {
  const [jeton, setJeton] = useState<string | null>(() => lire(CLE_JETON));
  const [profil, setProfil] = useState<Profil | null>(null);
  const [etat, setEtat] = useState<EtatSession>(() =>
    lire(CLE_JETON) ? 'chargement' : 'deconnecte',
  );
  const [tentative, setTentative] = useState(0);
  // Identifiant de l'établissement choisi (rangé dans l'onglet).
  const [choixId, setChoixId] = useState<string | null>(() =>
    lire(CLE_ETABLISSEMENT),
  );

  // Au démarrage : si une session existe dans l'onglet, on demande au serveur qui c'est.
  useEffect(() => {
    if (!jeton || profil) return;
    let annule = false;

    moi(jeton)
      .then((p) => {
        if (annule) return;
        setProfil(p);
        setEtat('connecte');
      })
      .catch((erreur: unknown) => {
        if (annule) return;
        if (erreur instanceof ErreurReseau) {
          setEtat('indisponible'); // on garde la session, le serveur reviendra
          return;
        }
        // Session refusée (expirée, personne supprimée...) : on repart de zéro.
        effacer(CLE_JETON);
        setJeton(null);
        setEtat('deconnecte');
      });

    return () => {
      annule = true;
    };
  }, [jeton, profil, tentative]);

  // L'établissement actif : celui qui a été choisi, s'il est encore actif ; sinon
  // le premier établissement actif de la personne.
  const etablissementActif = useMemo<Rattachement | null>(() => {
    if (!profil) return null;
    const utilisables = profil.etablissements.filter((e) => e.statut === 'actif');
    return (
      utilisables.find((e) => e.etablissementId === choixId) ??
      utilisables[0] ??
      null
    );
  }, [profil, choixId]);

  const choisirEtablissement = useCallback((etablissementId: string) => {
    ecrire(CLE_ETABLISSEMENT, etablissementId);
    setChoixId(etablissementId);
  }, []);

  // Après le clic sur le bouton Google : le serveur vérifie le jeton Google
  // et répond avec notre session. Peut lever une erreur (refus, serveur injoignable).
  const connecter = useCallback(async (credential: string) => {
    const reponse = await connexionGoogle(credential);
    ecrire(CLE_JETON, reponse.jeton);
    setProfil({
      utilisateur: reponse.utilisateur,
      etablissements: reponse.etablissements,
    });
    setJeton(reponse.jeton);
    setEtat('connecte');
  }, []);

  const deconnecter = useCallback(() => {
    googleLogout(); // empêche Google de reconnecter automatiquement la personne
    effacer(CLE_JETON);
    effacer(CLE_ETABLISSEMENT);
    setJeton(null);
    setChoixId(null);
    setProfil(null);
    setEtat('deconnecte');
  }, []);

  const recharger = useCallback(() => {
    setEtat('chargement');
    setTentative((t) => t + 1);
  }, []);

  const valeur = useMemo(
    () => ({
      etat,
      jeton,
      profil,
      etablissementActif,
      choisirEtablissement,
      connecter,
      deconnecter,
      recharger,
    }),
    [
      etat,
      jeton,
      profil,
      etablissementActif,
      choisirEtablissement,
      connecter,
      deconnecter,
      recharger,
    ],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

// Permet à un écran d'écrire : const { profil, deconnecter } = useSession();
export function useSession(): ContexteSession {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error('useSession doit être utilisé dans <FournisseurSession>.');
  }
  return contexte;
}