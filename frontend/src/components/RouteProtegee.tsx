import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../session/SessionContext';
import type { RoleMembre } from '../types';

interface Props {
  children: ReactNode;
  superAdmin?: boolean; // vrai : réservé au super-administrateur
  role?: RoleMembre; // réservé aux personnes ayant ce rôle dans leur établissement actif
}

// Entoure un écran qui exige une connexion.
//  - pas connecté : renvoi vers « /connexion »
//  - écran réservé au super-administrateur, ou à un rôle, et la personne ne l'a pas : renvoi vers « / »
export function RouteProtegee({ children, superAdmin = false, role }: Props) {
  const { etat, profil, etablissementActif, recharger } = useSession();

  if (etat === 'chargement') {
    return <p className="p-6">Chargement…</p>;
  }

  if (etat === 'indisponible') {
    return (
      <div className="mx-auto max-w-md p-6">
        <p className="mb-4 rounded bg-orange-50 p-3 text-orange-800">
          Le serveur est injoignable pour le moment.
        </p>
        <button
          type="button"
          onClick={recharger}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (etat === 'deconnecte' || !profil) {
    return <Navigate to="/connexion" replace />;
  }

  if (superAdmin && !profil.utilisateur.estSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Écran réservé à un rôle : il faut un établissement actif ET que le rôle y corresponde.
  if (role && etablissementActif?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}