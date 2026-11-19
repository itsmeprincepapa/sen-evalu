import { Link } from 'react-router';
import { LIBELLES_ROLE } from '../lib/libelles';
import { useSession } from '../session/SessionContext';
import { Bouton } from '../ui/Bouton';
import { Logo } from '../ui/Logo';

// En-tête des écrans connectés : logo, établissement actif (avec un sélecteur s'il y en a
// plusieurs), déconnexion, puis le titre de la page.
export function EnteteSession({ titre }: { titre: string }) {
  const { profil, etablissementActif, choisirEtablissement, deconnecter } =
    useSession();

  // Seuls les établissements ACTIFS peuvent être choisis.
  const utilisables =
    profil?.etablissements.filter((e) => e.statut === 'actif') ?? [];

  return (
    <header className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {/* Barre du haut : logo à gauche, établissement et déconnexion à droite */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Logo />
          sen-evalu
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {/* Plusieurs écoles : un sélecteur. Une seule : son nom et le rôle. */}
          {utilisables.length > 1 && (
            <select
              aria-label="Établissement"
              value={etablissementActif?.etablissementId ?? ''}
              onChange={(e) => choisirEtablissement(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {utilisables.map((e) => (
                <option key={e.etablissementId} value={e.etablissementId}>
                  {e.nom} ({LIBELLES_ROLE[e.role]})
                </option>
              ))}
            </select>
          )}
          {utilisables.length === 1 && etablissementActif && (
            <span className="text-sm text-slate-600">
              {etablissementActif.nom} · {LIBELLES_ROLE[etablissementActif.role]}
            </span>
          )}

          <Bouton variante="secondaire" taille="s" onClick={deconnecter}>
            Se déconnecter
          </Bouton>
        </div>
      </div>

      {/* Titre de la page et personne connectée */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h1 className="text-xl font-bold text-slate-900">{titre}</h1>
        {profil && (
          <p className="text-sm text-slate-500">
            {profil.utilisateur.prenom} {profil.utilisateur.nom} ·{' '}
            {profil.utilisateur.email}
          </p>
        )}
      </div>
    </header>
  );
}