import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../session/SessionContext';

interface Props {
  children: ReactNode;
  superAdmin?: boolean; // vrai : réservé au super-administrateur
}

// Entoure un écran qui exige une connexion.
//  - pas connecté : renvoi vers « /connexion »
//  - écran réservé au super-administrateur et personne d'autre : renvoi vers « / »
export function RouteProtegee({ children, superAdmin = false }: Props) {
  const { etat, profil, recharger } = useSession();

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

  return <>{children}</>;
}