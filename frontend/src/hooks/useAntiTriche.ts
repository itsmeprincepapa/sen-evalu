import { useCallback, useEffect, useRef, useState } from 'react';
import { ErreurApi, ErreurReseau, signalerIncident } from '../api/passage';
import type { MotifFin } from './useSauvegardeAuto';

// Les deux comportements que le navigateur de l'étudiant peut détecter.
export type TypeIncidentEtudiant = 'sortie_plein_ecran' | 'changement_onglet';

// Ce que l'étudiant doit voir après un incident (le premier : un avertissement).
export interface Avertissement {
  type: TypeIncidentEtudiant;
  nbIncidentsGraves: number;
  seuil: number;
}

interface Parametres {
  jeton: string;
  pleinEcranObligatoire: boolean;
  detecterChangementOnglet: boolean;
  // Envoie toutes les réponses non envoyées (fournie par la sauvegarde automatique).
  synchroniser: () => Promise<void>;
  // Termine l'évaluation à l'écran (fournie par la sauvegarde automatique).
  finir: (motif: MotifFin) => void;
}

const PAUSE_REESSAI_MS = 5_000;
const ESSAIS_MAX = 12;

// ANTI-TRICHE côté étudiant : plein écran et changements d'onglet.
// Le serveur décide (avertissement ou exclusion) ; ce hook détecte et signale.
export function useAntiTriche(p: Parametres) {
  const {
    jeton,
    pleinEcranObligatoire,
    detecterChangementOnglet,
    synchroniser,
    finir,
  } = p;

  // L'étudiant est-il en plein écran en ce moment ?
  const [enPleinEcran, setEnPleinEcran] = useState(
    () => document.fullscreenElement !== null,
  );
  // L'avertissement à afficher (null : rien à afficher).
  const [avertissement, setAvertissement] = useState<Avertissement | null>(null);
  // Vrai si le navigateur a refusé de passer en plein écran.
  const [refusPleinEcran, setRefusPleinEcran] = useState(false);

  // Vrai dès que l'étudiant a été en plein écran au moins une fois : seule une SORTIE
  // après cela est un incident (un rechargement de page n'en est pas un).
  const dejaEntre = useRef(false);
  // Vrai quand la page est en train d'être fermée ou rechargée : ce n'est pas un incident.
  const pageQuittee = useRef(false);

  // Signale un incident au serveur. Les réponses sont envoyées AVANT : si c'est le
  // dernier incident (exclusion), le serveur refuserait ensuite de les enregistrer.
  const signaler = useCallback(
    async (type: TypeIncidentEtudiant): Promise<void> => {
      for (let essai = 1; essai <= ESSAIS_MAX; essai++) {
        try {
          await synchroniser();
          const resultat = await signalerIncident(jeton, type);
          if (resultat.ignore) return; // doublon ou surveillance désactivée
          if (resultat.exclu) {
            finir('exclu');
            return;
          }
          setAvertissement({
            type,
            nbIncidentsGraves: resultat.nbIncidentsGraves,
            seuil: resultat.seuil,
          });
          return;
        } catch (erreur) {
          if (erreur instanceof ErreurApi) {
            // Le serveur a répondu : on affiche la bonne fin, ou on abandonne.
            if (erreur.statut === 403 && erreur.code === 'EXCLU') finir('exclu');
            else if (erreur.statut === 403 && erreur.code === 'TERMINE') finir('termine');
            else if (erreur.statut === 403 && erreur.code === 'TEMPS_ECOULE') finir('temps');
            else if (erreur.statut === 401) finir('session');
            return;
          }
          if (!(erreur instanceof ErreurReseau)) return;
          // Réseau coupé : on réessaie dans quelques secondes.
          await new Promise((resolve) => setTimeout(resolve, PAUSE_REESSAI_MS));
        }
      }
    },
    [jeton, synchroniser, finir],
  );

  // On écoute le navigateur : changement de plein écran, d'onglet, fermeture de la page.
  useEffect(() => {
    if (document.fullscreenElement) dejaEntre.current = true;

    const surChangementPleinEcran = () => {
      const plein = document.fullscreenElement !== null;
      setEnPleinEcran(plein);
      if (plein) {
        dejaEntre.current = true;
        return;
      }
      // Sortie du plein écran.
      if (dejaEntre.current && pleinEcranObligatoire && !pageQuittee.current) {
        void signaler('sortie_plein_ecran');
      }
    };

    const surVisibilite = () => {
      if (
        document.visibilityState === 'hidden' &&
        detecterChangementOnglet &&
        !pageQuittee.current
      ) {
        void signaler('changement_onglet');
      }
    };

    const surFermeture = () => {
      pageQuittee.current = true;
    };

    document.addEventListener('fullscreenchange', surChangementPleinEcran);
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('beforeunload', surFermeture);
    window.addEventListener('pagehide', surFermeture);
    return () => {
      document.removeEventListener('fullscreenchange', surChangementPleinEcran);
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('beforeunload', surFermeture);
      window.removeEventListener('pagehide', surFermeture);
    };
  }, [pleinEcranObligatoire, detecterChangementOnglet, signaler]);

  // Passer en plein écran (le navigateur l'exige sur un CLIC de l'étudiant).
  const demanderPleinEcran = useCallback(() => {
    setRefusPleinEcran(false);
    document.documentElement.requestFullscreen().catch(() => {
      setRefusPleinEcran(true);
    });
  }, []);

  const fermerAvertissement = useCallback(() => setAvertissement(null), []);

  return {
    enPleinEcran,
    avertissement,
    refusPleinEcran,
    demanderPleinEcran,
    fermerAvertissement,
  };
}