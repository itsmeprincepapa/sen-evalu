import { Navigate } from 'react-router';
import { EnteteSession } from '../components/EnteteSession';
import { useSession } from '../session/SessionContext';

const LIBELLES_ROLE = { admin: 'Administrateur', enseignant: 'Enseignant' };

// Accueil provisoire des enseignants et administrateurs d'école.
// (Les vrais espaces arrivent à l'étape 5 : classes, enseignants, évaluations.)
export function PageAccueil() {
  const { profil } = useSession();

  // « RouteProtegee » garantit que le profil existe ; cette ligne rassure TypeScript.
  if (!profil) return null;

  // Le super-administrateur a son propre espace.
  if (profil.utilisateur.estSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="sen-evalu" />

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold">Vos établissements</h2>

        {profil.etablissements.length === 0 ? (
          <p className="text-slate-600">
            Vous n’êtes rattaché à aucun établissement pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {profil.etablissements.map((e) => (
              <li
                key={e.etablissementId}
                className="flex items-center justify-between rounded border border-slate-200 p-3"
              >
                <div>
                  <p className="font-medium">{e.nom}</p>
                  <p className="text-sm text-slate-600">{LIBELLES_ROLE[e.role]}</p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    e.statut === 'actif'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {e.statut === 'actif' ? 'Actif' : 'Inactif'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-sm text-slate-500">
          Les espaces de travail (classes, évaluations) arrivent prochainement.
        </p>
      </section>
    </div>
  );
}