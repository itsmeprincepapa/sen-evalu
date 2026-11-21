import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { lireJournal, lireSuivi } from '../api/suivi';
import type {
  EvaluationSuivie,
  InstantaneSuivi,
  LigneEtudiant,
  LigneJournal,
} from '../types';

// Adresse du serveur : « VITE_API_URL » si elle est définie, sinon le serveur local.
const URL_API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Une ligne du tableau, avec l'instant où elle a été reçue : l'écran s'en sert pour faire
// diminuer le temps restant seconde par seconde, entre deux messages du serveur.
export type LigneSuivie = LigneEtudiant & { recuLe: number };

// L'état de la liaison en direct avec le serveur.
export type EtatLiaison = 'connexion' | 'en-direct' | 'interrompue';

// La réponse du serveur quand on rejoint une évaluation.
type ReponseRejoindre =
  | ({ ok: true } & InstantaneSuivi)
  | { ok: false; message: string };

interface Parametres {
  jeton: string;
  etablissementId: string;
  evaluationId: string;
  onErreur: (erreur: unknown) => void;
}

const DUREE_ALERTE_MS = 20_000;
const PERIODE_RECALAGE_MS = 60_000;

// Le suivi d'une évaluation : état des étudiants et journal, mis à jour EN DIRECT par le
// serveur (Socket.IO), avec un recalage complet toutes les 60 secondes par sécurité.
export function useSuiviEnDirect(p: Parametres) {
  const { jeton, etablissementId, evaluationId, onErreur } = p;

  const [evaluation, setEvaluation] = useState<EvaluationSuivie | null>(null);
  const [etudiants, setEtudiants] = useState<Record<string, LigneSuivie>>({});
  const [journal, setJournal] = useState<LigneJournal[]>([]);
  const [alertes, setAlertes] = useState<LigneJournal[]>([]);
  const [liaison, setLiaison] = useState<EtatLiaison>('connexion');

  // La page est-elle encore affichée ? (évite de mettre à jour un écran déjà quitté)
  const vivant = useRef(true);
  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);

  // On garde la dernière version de « onErreur » sans relancer les effets.
  const onErreurRef = useRef(onErreur);
  useEffect(() => {
    onErreurRef.current = onErreur;
  }, [onErreur]);

  // Applique un état complet reçu du serveur.
  const appliquer = useCallback((instantane: InstantaneSuivi) => {
    const recuLe = Date.now();
    setEvaluation(instantane.evaluation);
    setEtudiants(
      Object.fromEntries(
        instantane.etudiants.map((e) => [e.participationId, { ...e, recuLe }]),
      ),
    );
  }, []);

  // Relit tout auprès du serveur (état des étudiants et journal).
  // Les données arrivent dans une « promesse » : le setState est appelé quand elles sont
  // arrivées, jamais directement dans le corps d'un effet.
  const rafraichir = useCallback(() => {
    Promise.all([
      lireSuivi(jeton, etablissementId, evaluationId),
      lireJournal(jeton, etablissementId, evaluationId),
    ])
      .then(([instantane, lignes]) => {
        if (!vivant.current) return;
        appliquer(instantane);
        setJournal(lignes);
      })
      .catch((erreur: unknown) => {
        if (vivant.current) onErreurRef.current(erreur);
      });
  }, [jeton, etablissementId, evaluationId, appliquer]);

  // Premier chargement, puis recalage toutes les 60 secondes.
  useEffect(() => {
    rafraichir();
    const id = setInterval(rafraichir, PERIODE_RECALAGE_MS);
    return () => clearInterval(id);
  }, [rafraichir]);

  // La liaison en direct (Socket.IO).
  useEffect(() => {
    const socket = io(`${URL_API}/suivi`, {
      auth: { jeton, etablissementId },
    });

    // Quand la liaison s'établit (ou se rétablit après une coupure) : on rejoint l'évaluation.
    socket.on('connect', () => {
      setLiaison('connexion');
      socket.emit(
        'rejoindre',
        { evaluationId },
        (reponse: ReponseRejoindre) => {
          if (!reponse.ok) {
            setLiaison('interrompue');
            onErreurRef.current(new Error(reponse.message));
            return;
          }
          appliquer(reponse);
          setLiaison('en-direct');
        },
      );
      rafraichir(); // le journal a pu bouger pendant une coupure
    });

    socket.on('disconnect', () => setLiaison('interrompue'));

    socket.on('connect_error', () => {
      setLiaison('interrompue');
      // Si la bibliothèque ne réessaie plus, c'est un refus : on prévient l'enseignant.
      if (!socket.active) {
        onErreurRef.current(new Error('La liaison en direct a été refusée.'));
      }
    });

    // Un étudiant a changé : on remplace sa ligne.
    socket.on('etudiant:maj', (ligne: LigneEtudiant) => {
      const recuLe = Date.now();
      setEtudiants((avant) => ({
        ...avant,
        [ligne.participationId]: { ...ligne, recuLe },
      }));
    });

    // Un nouvel incident : journal, et alerte s'il est grave.
    socket.on('incident', (incident: LigneJournal) => {
      setJournal((avant) =>
        avant.some((i) => i.id === incident.id)
          ? avant
          : [incident, ...avant].slice(0, 500),
      );
      if (incident.gravite === 'grave') {
        setAlertes((avant) => [...avant, incident]);
        setTimeout(() => {
          setAlertes((avant) => avant.filter((a) => a.id !== incident.id));
        }, DUREE_ALERTE_MS);
      }
    });

    // L'évaluation elle-même a changé (terminée...).
    socket.on('evaluation:maj', (maj: { statut: string }) => {
      setEvaluation((avant) =>
        avant ? { ...avant, statut: maj.statut } : avant,
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [jeton, etablissementId, evaluationId, appliquer, rafraichir]);

  // Les étudiants dans l'ordre alphabétique.
  const liste = useMemo(
    () =>
      Object.values(etudiants).sort((a, b) =>
        `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'),
      ),
    [etudiants],
  );

  // Ferme une alerte à la main.
  const fermerAlerte = useCallback((id: string) => {
    setAlertes((avant) => avant.filter((a) => a.id !== id));
  }, []);

  return { evaluation, etudiants: liste, journal, alertes, liaison, fermerAlerte, rafraichir };
}