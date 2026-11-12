import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ErreurApi,
  ErreurReseau,
  ping,
  sauvegarder,
  terminer as terminerApi,
} from '../api/passage';
import { ecrireCopie, type CopieLocale } from '../lib/copieLocale';
import type { Contenu, ReponseServeur } from '../types';

// Sauvegarde 3 secondes après la dernière frappe...
const DELAI_SAISIE_MS = 3_000;
// ... et, dans tous les cas, toutes les 10 secondes.
const PERIODE_SYNCHRO_MS = 10_000;

export type EtatReseau = 'connecte' | 'hors-ligne';

// Pourquoi l'évaluation se termine : temps écoulé, terminée par l'étudiant,
// ou session remplacée (le même étudiant s'est reconnecté ailleurs).
export type MotifFin = 'temps' | 'termine' | 'session';

// Une réponse en cours d'écriture.
//  - version : augmente à chaque modification
//  - envoyee : dernière version CONFIRMÉE par le serveur (0 = jamais envoyée)
// Si version > envoyee, il reste quelque chose à envoyer.
export interface Brouillon {
  contenu: Contenu;
  version: number;
  envoyee: number;
}
type Brouillons = Record<string, Brouillon>;

// Fusionne ce que le serveur connaît et la copie locale : la version la plus récente gagne.
export function fusionner(
  serveur: ReponseServeur[],
  locale: CopieLocale,
): Brouillons {
  const resultat: Brouillons = {};

  for (const r of serveur) {
    if (r.contenu !== null) {
      resultat[r.questionId] = {
        contenu: r.contenu,
        version: r.version,
        envoyee: r.version,
      };
    }
  }

  for (const [questionId, copie] of Object.entries(locale)) {
    const deja = resultat[questionId];
    // La copie locale est plus récente que le serveur : elle gagne, et sera renvoyée.
    if (!deja || copie.version > deja.version) {
      resultat[questionId] = {
        contenu: copie.contenu,
        version: copie.version,
        envoyee: deja?.envoyee ?? 0,
      };
    }
  }
  return resultat;
}

interface Parametres {
  jeton: string;
  cleCopie: string; // clé de la copie locale (propre à cette évaluation et à cet étudiant)
  reponsesInitiales: ReponseServeur[];
  copieInitiale: CopieLocale;
  secondesInitiales: number;
  onFin: (motif: MotifFin) => void;
}

export function useSauvegardeAuto(p: Parametres) {
  const {
    jeton,
    cleCopie,
    reponsesInitiales,
    copieInitiale,
    secondesInitiales,
    onFin,
  } = p;

  // Les brouillons existent en DEUX exemplaires :
  //  - « brouillons » (état React) : sert à afficher l'écran ;
  //  - « brouillonsRef » (ref) : sert à la logique d'envoi. Une ref se lit et
  //    se modifie immédiatement, sans attendre le prochain affichage.
  const [brouillons, setBrouillons] = useState<Brouillons>(() =>
    fusionner(reponsesInitiales, copieInitiale),
  );
  const brouillonsRef = useRef<Brouillons>(brouillons);

  const [reseau, setReseau] = useState<EtatReseau>('connecte');
  const [secondes, setSecondes] = useState(secondesInitiales);

  // Instant de fin, mesuré avec l'horloge MONOTONE du navigateur (performance.now) :
  // elle ne dépend pas de l'heure de l'ordinateur, donc changer l'heure
  // de Windows ne donne aucun temps en plus.
  const finMonotone = useRef(performance.now() + secondesInitiales * 1000);

  const finie = useRef(false); // l'évaluation est-elle terminée ?
  const finDemandee = useRef(false); // la fin par le temps a-t-elle déjà été lancée ?
  const enCours = useRef<Promise<void> | null>(null); // envoi en cours
  const relancer = useRef(false); // un nouvel envoi est demandé pendant un envoi
  const minuteurSaisie = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // On garde la dernière version de « onFin » sans relancer les effets.
  const onFinRef = useRef(onFin);
  useEffect(() => {
    onFinRef.current = onFin;
  }, [onFin]);

  // Met à jour les brouillons dans la ref ET dans l'état.
  const majBrouillons = useCallback(
    (maj: (b: Brouillons) => Brouillons) => {
      brouillonsRef.current = maj(brouillonsRef.current);
      setBrouillons(brouillonsRef.current);
    },
    [],
  );

  // Recale le minuteur sur le temps restant annoncé par le serveur.
  const recaler = useCallback((secondesServeur: number) => {
    finMonotone.current = performance.now() + secondesServeur * 1000;
    setSecondes(secondesServeur);
  }, []);

  // Termine l'évaluation côté écran (une seule fois).
  const finir = useCallback((motif: MotifFin) => {
    if (finie.current) return;
    finie.current = true;
    clearTimeout(minuteurSaisie.current);
    onFinRef.current(motif);
  }, []);

  // Que faire quand un échange avec le serveur échoue ?
  const traiterErreur = useCallback(
    (erreur: unknown) => {
      if (erreur instanceof ErreurApi) {
        if (erreur.statut === 403 && erreur.code === 'TEMPS_ECOULE') {
          finir('temps');
          return;
        }
        if (erreur.statut === 403 && erreur.code === 'TERMINE') {
          finir('termine');
          return;
        }
        if (erreur.statut === 401) {
          finir('session'); // le jeton a été remplacé par une autre connexion
          return;
        }
      }
      // Serveur injoignable ou en panne : on garde tout en mémoire et on réessaiera.
      if (!(erreur instanceof ErreurReseau)) console.error(erreur);
      setReseau('hors-ligne');
    },
    [finir],
  );

  // ENVOI : envoie les réponses non envoyées, ou un simple « ping » s'il n'y en a pas.
  // Un seul envoi à la fois ; une demande arrivée pendant un envoi en relance un second.
  // La fonction renvoie une promesse qui se termine quand l'envoi est fini.
  const synchroniser = useCallback((): Promise<void> => {
    if (finie.current) return Promise.resolve();
    if (enCours.current) {
      relancer.current = true;
      return enCours.current;
    }

    const promesse = (async () => {
      try {
        do {
          relancer.current = false;
          const aEnvoyer = Object.entries(brouillonsRef.current).filter(
            ([, b]) => b.version > b.envoyee,
          );

          if (aEnvoyer.length === 0) {
            // Rien à envoyer : un « ping » prouve qu'on est là et recale le minuteur.
            const accuse = await ping(jeton);
            recaler(accuse.tempsRestantSecondes);
          } else {
            for (const [questionId, brouillon] of aEnvoyer) {
              const accuse = await sauvegarder(
                jeton,
                questionId,
                brouillon.contenu,
                brouillon.version,
              );
              // Le serveur a reçu cette version : on la marque « envoyée ».
              // (Si l'étudiant a tapé entre-temps, la version est plus haute : il reste à envoyer.)
              majBrouillons((b) => {
                const courant = b[questionId];
                if (!courant) return b;
                return {
                  ...b,
                  [questionId]: {
                    ...courant,
                    envoyee: Math.max(courant.envoyee, brouillon.version),
                  },
                };
              });
              recaler(accuse.tempsRestantSecondes);
            }
          }
          setReseau('connecte');
        } while (relancer.current && !finie.current);
      } catch (erreur) {
        traiterErreur(erreur);
      }
    })();

    enCours.current = promesse;
    // Une fois terminé, on libère la place pour le prochain envoi.
    void promesse.finally(() => {
      if (enCours.current === promesse) enCours.current = null;
    });
    return promesse;
  }, [jeton, majBrouillons, recaler, traiterErreur]);

  // L'étudiant modifie une réponse.
  const modifier = useCallback(
    (questionId: string, contenu: Contenu) => {
      if (finie.current) return;

      // Nouvelle version = ancienne + 1.
      majBrouillons((b) => {
        const avant = b[questionId];
        return {
          ...b,
          [questionId]: {
            contenu,
            version: (avant?.version ?? 0) + 1,
            envoyee: avant?.envoyee ?? 0,
          },
        };
      });

      // Copie locale IMMÉDIATE : même si le réseau et le serveur tombent, rien n'est perdu.
      const copie: CopieLocale = {};
      for (const [id, b] of Object.entries(brouillonsRef.current)) {
        copie[id] = { contenu: b.contenu, version: b.version };
      }
      ecrireCopie(cleCopie, copie);

      // Envoi au serveur 3 secondes après la DERNIÈRE frappe.
      clearTimeout(minuteurSaisie.current);
      minuteurSaisie.current = setTimeout(() => {
        void synchroniser();
      }, DELAI_SAISIE_MS);
    },
    [cleCopie, majBrouillons, synchroniser],
  );

  // L'étudiant clique sur « Terminer ».
  // On envoie d'abord TOUT ; si une réponse n'a pas pu partir, on refuse de terminer
  // (sinon elle serait perdue, car le serveur refuse les sauvegardes après la fin).
  const terminerMaintenant = useCallback(async () => {
    await synchroniser();
    const reste = Object.values(brouillonsRef.current).some(
      (b) => b.version > b.envoyee,
    );
    if (reste) {
      throw new ErreurReseau(
        'Certaines réponses ne sont pas encore envoyées. Vérifiez la connexion, puis réessayez.',
      );
    }
    try {
      await terminerApi(jeton);
    } catch (erreur) {
      // 403 : déjà terminée côté serveur, ce n'est pas un problème.
      if (!(erreur instanceof ErreurApi && erreur.statut === 403)) throw erreur;
    }
    finir('termine');
  }, [finir, jeton, synchroniser]);

  // Au démarrage : un premier envoi (renvoie ce que la copie locale avait de plus récent
  // et recale le minuteur), puis un envoi toutes les 10 secondes.
  useEffect(() => {
    void synchroniser();
    const id = setInterval(() => {
      void synchroniser();
    }, PERIODE_SYNCHRO_MS);
    return () => clearInterval(id);
  }, [synchroniser]);

  // Le minuteur affiché : il décompte à partir de la dernière valeur du serveur.
  useEffect(() => {
    const id = setInterval(() => {
      const restant = Math.max(
        0,
        Math.ceil((finMonotone.current - performance.now()) / 1000),
      );
      setSecondes(restant);

      // Temps écoulé à l'écran : un dernier envoi, puis fin.
      if (restant === 0 && !finDemandee.current) {
        finDemandee.current = true;
        void synchroniser().finally(() => finir('temps'));
      }
    }, 500);
    return () => clearInterval(id);
  }, [synchroniser, finir]);

  // Si la page se ferme, on annule l'envoi programmé (la copie locale reste).
  useEffect(() => () => clearTimeout(minuteurSaisie.current), []);

  // Nombre de réponses pas encore confirmées par le serveur.
  const nbNonEnvoyees = Object.values(brouillons).filter(
    (b) => b.version > b.envoyee,
  ).length;

  return { brouillons, modifier, secondes, reseau, nbNonEnvoyees, terminerMaintenant };
}