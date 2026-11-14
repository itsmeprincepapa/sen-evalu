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
import type { Profil } from '../types';

// Où est rangée la session : « sessionStorage » est propre à l'onglet et disparaît à sa
// fermeture (c'est plus prudent sur un ordinateur partagé qu'un stockage permanent).
const CLE_JETON = 'sen-evalu:jeton';

function lireJeton(): string | null {
  try {
    return sessionStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}
function ecrireJeton(jeton: string): void {
  try {
    sessionStorage.setItem(CLE_JETON, jeton);
  } catch {
    // Stockage bloqué : la personne devra se reconnecter après un rechargement.
  }
}
function effacerJeton(): void {
  try {
    sessionStorage.removeItem(CLE_JETON);
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
  connecter: (credential: string) => Promise<void>;
  deconnecter: () => void;
  recharger: () => void;
}

const Contexte = createContext<ContexteSession | null>(null);

// À placer autour de toute l'application : il fournit la session à tous les écrans.
export function FournisseurSession({ children }: { children: ReactNode }) {
  const [jeton, setJeton] = useState<string | null>(() => lireJeton());
  const [profil, setProfil] = useState<Profil | null>(null);
  const [etat, setEtat] = useState<EtatSession>(() =>
    lireJeton() ? 'chargement' : 'deconnecte',
  );
  const [tentative, setTentative] = useState(0);

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
        effacerJeton();
        setJeton(null);
        setEtat('deconnecte');
      });

    return () => {
      annule = true;
    };
  }, [jeton, profil, tentative]);

  // Après le clic sur le bouton Google : le serveur vérifie le jeton Google
  // et répond avec notre session. Peut lever une erreur (refus, serveur injoignable).
  const connecter = useCallback(async (credential: string) => {
    const reponse = await connexionGoogle(credential);
    ecrireJeton(reponse.jeton);
    setProfil({
      utilisateur: reponse.utilisateur,
      etablissements: reponse.etablissements,
    });
    setJeton(reponse.jeton);
    setEtat('connecte');
  }, []);

  const deconnecter = useCallback(() => {
    googleLogout(); // empêche Google de reconnecter automatiquement la personne
    effacerJeton();
    setJeton(null);
    setProfil(null);
    setEtat('deconnecte');
  }, []);

  const recharger = useCallback(() => {
    setEtat('chargement');
    setTentative((t) => t + 1);
  }, []);

  const valeur = useMemo(
    () => ({ etat, jeton, profil, connecter, deconnecter, recharger }),
    [etat, jeton, profil, connecter, deconnecter, recharger],
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