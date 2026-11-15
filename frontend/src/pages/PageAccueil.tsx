import { Link, Navigate } from 'react-router';
import { EnteteSession } from '../components/EnteteSession';
import { LIBELLES_ROLE } from '../lib/libelles';
import { useSession } from '../session/SessionContext';

// Accueil des enseignants et des administrateurs d'école.
// Les liens affichés dépendent du rôle dans l'établissement actif.
export function PageAccueil() {
  const { profil, etablissementActif } = useSession();

  // « RouteProtegee » garantit que le profil existe ; cette ligne rassure TypeScript.
  if (!profil) return null;

  // Le super-administrateur a son propre espace.
  if (profil.utilisateur.estSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="sen-evalu" />

      {/* Espace de travail : dépend du rôle dans l'établissement actif */}
      {etablissementActif ? (
        <section className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">{etablissementActif.nom}</h2>
          <p className="mb-4 text-sm text-slate-600">
            {LIBELLES_ROLE[etablissementActif.role]}
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Les classes : administrateurs et enseignants */}
            <Link
              to="/ecole/classes"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Gérer les classes
            </Link>

            {/* Les enseignants : administrateurs seulement */}
            {etablissementActif.role === 'admin' && (
              <Link
                to="/ecole/enseignants"
                className="rounded border border-blue-600 px-4 py-2 text-blue-700 hover:bg-blue-50"
              >
                Gérer les enseignants
              </Link>
            )}
          </div>
                      {/* Les évaluations : enseignants seulement */}
            {etablissementActif.role === 'enseignant' && (
              <Link
                to="/ecole/evaluations"
                className="rounded border border-blue-600 px-4 py-2 text-blue-700 hover:bg-blue-50"
              >
                Mes évaluations
              </Link>
            )}

          
        </section>
      ) : (
        <p className="mb-6 rounded bg-orange-50 p-4 text-orange-800">
          {profil.etablissements.length === 0
            ? 'Vous n’êtes rattaché à aucun établissement pour le moment. Contactez votre administrateur.'
            : 'Vos établissements sont désactivés pour le moment.'}
        </p>
      )}

      {/* Tous les établissements de la personne, avec leur état */}
      {profil.etablissements.length > 0 && (
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-semibold">Vos établissements</h2>
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
        </section>
      )}
    </div>
  );
}