import { useCallback, useState } from 'react';
import { ErreurApi, ErreurReseau } from '../api/http';
import { useSession } from '../session/SessionContext';

// Outil partagé par les écrans : garde le message d'erreur à afficher, et sait transformer
// une erreur reçue en message lisible.
//  - session refusée (401) : la personne est déconnectée ;
//  - serveur injoignable : message dédié ;
//  - autre refus : on affiche le message du serveur (il est écrit pour être lu).
export function useErreurs() {
  const { deconnecter } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);

  const traiter = useCallback(
    (e: unknown) => {
      if (e instanceof ErreurApi && e.statut === 401) {
        deconnecter();
        return;
      }
      if (e instanceof ErreurReseau) {
        setErreur('Impossible de joindre le serveur.');
        return;
      }
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.');
    },
    [deconnecter],
  );

  return { erreur, setErreur, traiter };
}