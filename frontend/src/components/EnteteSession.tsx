import { useSession } from '../session/SessionContext';

// En-tête des écrans connectés : titre, personne connectée, bouton de déconnexion.
export function EnteteSession({ titre }: { titre: string }) {
  const { profil, deconnecter } = useSession();

  return (
    <header className="mb-6 flex items-center justify-between rounded-lg bg-white p-4 shadow">
      <div>
        <h1 className="text-lg font-bold">{titre}</h1>
        {profil && (
          <p className="text-sm text-slate-600">
            {profil.utilisateur.prenom} {profil.utilisateur.nom} ·{' '}
            {profil.utilisateur.email}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={deconnecter}
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
      >
        Se déconnecter
      </button>
    </header>
  );
}