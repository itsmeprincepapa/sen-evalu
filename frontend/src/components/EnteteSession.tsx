import { LIBELLES_ROLE } from '../lib/libelles';
import { useSession } from '../session/SessionContext';

// En-tête des écrans connectés : titre, personne connectée, établissement actif
// (avec un sélecteur s'il y en a plusieurs), bouton de déconnexion.
export function EnteteSession({ titre }: { titre: string }) {
  const { profil, etablissementActif, choisirEtablissement, deconnecter } =
    useSession();

  // Seuls les établissements ACTIFS peuvent être choisis.
  const utilisables =
    profil?.etablissements.filter((e) => e.statut === 'actif') ?? [];

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow">
      <div>
        <h1 className="text-lg font-bold">{titre}</h1>
        {profil && (
          <p className="text-sm text-slate-600">
            {profil.utilisateur.prenom} {profil.utilisateur.nom} ·{' '}
            {profil.utilisateur.email}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Plusieurs écoles : un sélecteur. Une seule : son nom et le rôle. */}
        {utilisables.length > 1 && (
          <select
            aria-label="Établissement"
            value={etablissementActif?.etablissementId ?? ''}
            onChange={(e) => choisirEtablissement(e.target.value)}
            className="rounded border border-slate-300 p-1 text-sm"
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

        <button
          type="button"
          onClick={deconnecter}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        >
          Se déconnecter
        </button>
      </div>
    </header>
  );
}