import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ajouterAdministrateur,
  changerStatut,
  creerEtablissement,
  listerEtablissements,
} from '../../api/superAdmin';
import { ErreurApi, ErreurReseau } from '../../api/http';
import { EnteteSession } from '../../components/EnteteSession';
import { useSession } from '../../session/SessionContext';
import type { EtablissementListe } from '../../types';

// L'espace du super-administrateur : gérer les établissements.
export function PageEtablissements() {
  const { jeton, deconnecter } = useSession();
  const jetonSession = jeton ?? '';

  const [liste, setListe] = useState<EtablissementListe[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Formulaire « créer un établissement »
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');

  // Formulaire « ajouter un administrateur » (ouvert pour UN établissement à la fois)
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNom, setAdminNom] = useState('');
  const [adminPrenom, setAdminPrenom] = useState('');

  // Transforme une erreur en message. Une session refusée (401) déconnecte la personne.
  const traiterErreur = useCallback(
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

  // Charge la liste des établissements.
  const charger = useCallback(async () => {
    try {
      setListe(await listerEtablissements(jetonSession));
    } catch (e) {
      traiterErreur(e);
    }
  }, [jetonSession, traiterErreur]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Création d'un établissement.
  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setInfo(null);
    try {
      await creerEtablissement(jetonSession, nom.trim(), ville.trim());
      setNom('');
      setVille('');
      setInfo('Établissement créé.');
      await charger();
    } catch (e) {
      traiterErreur(e);
    }
  }

  // L'interrupteur actif / inactif. On demande confirmation avant de DÉSACTIVER.
  async function basculer(e: EtablissementListe) {
    const desactivation = e.statut === 'actif';
    if (
      desactivation &&
      !window.confirm(
        `Désactiver « ${e.nom} » ?\n\nSes enseignants et administrateurs perdent l’accès immédiatement. ` +
          'Les évaluations déjà commencées se terminent normalement, mais aucune nouvelle ne démarre.',
      )
    ) {
      return;
    }
    setErreur(null);
    setInfo(null);
    try {
      await changerStatut(jetonSession, e.id, desactivation ? 'inactif' : 'actif');
      await charger();
    } catch (err) {
      traiterErreur(err);
    }
  }

  // Ajout d'un administrateur à un établissement.
  async function ajouterAdmin(
    evenement: FormEvent<HTMLFormElement>,
    etablissementId: string,
  ) {
    evenement.preventDefault();
    setErreur(null);
    setInfo(null);
    try {
      await ajouterAdministrateur(jetonSession, etablissementId, {
        email: adminEmail.trim(),
        nom: adminNom.trim(),
        prenom: adminPrenom.trim(),
      });
      setInfo(
        'Administrateur ajouté : il pourra se connecter avec ce compte Google.',
      );
      setOuvert(null);
      setAdminEmail('');
      setAdminNom('');
      setAdminPrenom('');
      await charger();
    } catch (e) {
      traiterErreur(e);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Espace super-administrateur" />

      {erreur && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
          {info}
        </p>
      )}

      {/* Créer un établissement */}
      <form
        onSubmit={creer}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow"
      >
        <label className="flex-1">
          <span className="text-sm font-medium">Nom de l’établissement</span>
          <input
            required
            minLength={2}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2"
          />
        </label>
        <label className="w-40">
          <span className="text-sm font-medium">Ville</span>
          <input
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Créer
        </button>
      </form>

      {/* La liste des établissements */}
      {liste === null ? (
        <p>Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="text-slate-600">Aucun établissement pour le moment.</p>
      ) : (
        <ul className="space-y-4">
          {liste.map((e) => (
            <li key={e.id} className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{e.nom}</h2>
                  <p className="text-sm text-slate-600">
                    {e.ville ?? 'Ville non renseignée'} · créé le{' '}
                    {new Date(e.creeLe).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* L'interrupteur actif / inactif */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {e.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={e.statut === 'actif'}
                    aria-label={`Activer ou désactiver ${e.nom}`}
                    onClick={() => void basculer(e)}
                    className={`relative h-6 w-11 rounded-full transition ${
                      e.statut === 'actif' ? 'bg-green-600' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                        e.statut === 'actif' ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Les administrateurs de l'établissement */}
              <div className="mt-3">
                <p className="text-sm font-medium">Administrateurs</p>
                {e.administrateurs.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun pour le moment.</p>
                ) : (
                  <ul className="text-sm text-slate-700">
                    {e.administrateurs.map((a) => (
                      <li key={a.email}>
                        {a.prenom} {a.nom} · {a.email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ajouter un administrateur */}
              {ouvert === e.id ? (
                <form
                  onSubmit={(evenement) => void ajouterAdmin(evenement, e.id)}
                  className="mt-3 space-y-2 rounded border border-slate-200 p-3"
                >
                  <input
                    required
                    type="email"
                    placeholder="Adresse Google de l’administrateur"
                    value={adminEmail}
                    onChange={(ev) => setAdminEmail(ev.target.value)}
                    className="w-full rounded border border-slate-300 p-2"
                  />
                  <div className="flex gap-2">
                    <input
                      required
                      placeholder="Prénom"
                      value={adminPrenom}
                      onChange={(ev) => setAdminPrenom(ev.target.value)}
                      className="w-full rounded border border-slate-300 p-2"
                    />
                    <input
                      required
                      placeholder="Nom"
                      value={adminNom}
                      onChange={(ev) => setAdminNom(ev.target.value)}
                      className="w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={() => setOuvert(null)}
                      className="rounded border border-slate-300 px-3 py-1 text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setOuvert(e.id)}
                  className="mt-3 text-sm text-blue-700 hover:underline"
                >
                  + Ajouter un administrateur
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}