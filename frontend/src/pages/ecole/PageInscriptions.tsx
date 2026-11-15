import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  corrigerInscription,
  listerInscriptions,
  listerMesEvaluations,
  refuserInscriptions,
  validerInscriptions,
} from '../../api/evaluations';
import { EnteteSession } from '../../components/EnteteSession';
import { useErreurs } from '../../hooks/useErreurs';
import { LIBELLES_STATUT_PARTICIPATION } from '../../lib/libelles';
import { useSession } from '../../session/SessionContext';
import type { InscriptionLigne } from '../../types';

interface Props {
  idEtablissement: string;
  idEvaluation: string;
}

// Le contenu de la page, pour UNE évaluation d'UN établissement.
function ContenuInscriptions({ idEtablissement, idEvaluation }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? '';
  const { erreur, setErreur, traiter } = useErreurs();

  const [titre, setTitre] = useState<string | null>(null);
  const [lignes, setLignes] = useState<InscriptionLigne[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Les demandes cochées par l'enseignant
  const [selection, setSelection] = useState<string[]>([]);

  // La demande en cours de correction (une seule à la fois) et ses champs
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');

  // « Compteur de rechargement » : on l'augmente pour demander un nouveau chargement.
  const [rechargement, setRechargement] = useState(0);
  const recharger = useCallback(() => setRechargement((n) => n + 1), []);

  // Charge le titre de l'évaluation et ses demandes, au départ puis à chaque rechargement.
  useEffect(() => {
    let annule = false;
    Promise.all([
      listerMesEvaluations(jetonSession, idEtablissement),
      listerInscriptions(jetonSession, idEtablissement, idEvaluation),
    ])
      .then(([evaluations, liste]) => {
        if (annule) return;
        setTitre(evaluations.find((e) => e.id === idEvaluation)?.titre ?? null);
        setLignes(liste);
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e); // une évaluation d'un autre enseignant donne « introuvable »
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idEvaluation, traiter, rechargement]);

  // Actualisation automatique toutes les 10 secondes : les nouvelles demandes apparaissent seules.
  useEffect(() => {
    const id = setInterval(recharger, 10_000);
    return () => clearInterval(id);
  }, [recharger]);

  // Exécute une action, affiche le résultat, puis recharge. Renvoie vrai si elle a réussi.
  async function executer(travail: () => Promise<unknown>, succes: string) {
    setErreur(null);
    setInfo(null);
    try {
      await travail();
      setInfo(succes);
      setSelection([]);
      recharger();
      return true;
    } catch (e) {
      traiter(e);
      return false;
    }
  }

  function basculerSelection(id: string) {
    setSelection((actuelle) =>
      actuelle.includes(id) ? actuelle.filter((x) => x !== id) : [...actuelle, id],
    );
  }

  async function validerTout() {
    if (
      !window.confirm(
        `Valider les ${enAttente.length} demandes en attente ?\n\nCes étudiants pourront saisir le code d’accès et seront enregistrés dans l’école.`,
      )
    ) {
      return;
    }
    await executer(
      () => validerInscriptions(jetonSession, idEtablissement, idEvaluation, { tous: true }),
      'Toutes les demandes en attente ont été validées.',
    );
  }

  async function validerSelection(ids: string[]) {
    await executer(
      () => validerInscriptions(jetonSession, idEtablissement, idEvaluation, { ids }),
      ids.length > 1 ? 'Demandes validées.' : 'Demande validée.',
    );
  }

  async function refuserSelection(ids: string[]) {
    if (!window.confirm(`Refuser ${ids.length} demande${ids.length > 1 ? 's' : ''} ?`)) return;
    await executer(
      () => refuserInscriptions(jetonSession, idEtablissement, idEvaluation, ids),
      ids.length > 1 ? 'Demandes refusées.' : 'Demande refusée.',
    );
  }

  // Ouvre le formulaire de correction d'une demande.
  function commencerCorrection(l: InscriptionLigne) {
    setEnEdition(l.id);
    setEditEmail(l.email);
    setEditNom(l.nom);
    setEditPrenom(l.prenom);
  }

  async function enregistrerCorrection(evenement: FormEvent<HTMLFormElement>, id: string) {
    evenement.preventDefault();
    const reussi = await executer(
      () =>
        corrigerInscription(jetonSession, idEtablissement, idEvaluation, id, {
          email: editEmail.trim(),
          nom: editNom.trim(),
          prenom: editPrenom.trim(),
        }),
      'Informations corrigées.',
    );
    if (reussi) setEnEdition(null);
  }

  // Les demandes, rangées par état.
  const toutes = lignes ?? [];
  const enAttente = toutes.filter((l) => l.statut === 'en_attente');
  const validees = toutes.filter((l) => l.statut === 'valide' || l.statut === 'en_cours');
  const refusees = toutes.filter((l) => l.statut === 'refuse');
  const autres = toutes.filter((l) => l.statut === 'exclu' || l.statut === 'termine');

  // Les demandes cochées qui sont encore en attente.
  const cochees = selection.filter((id) => enAttente.some((l) => l.id === id));

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Inscriptions" />

      <Link
        to="/ecole/evaluations"
        className="mb-4 inline-block text-sm text-blue-700 hover:underline"
      >
        ← Mes évaluations
      </Link>

      {titre && <h2 className="mb-4 text-xl font-bold">{titre}</h2>}

      {erreur && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">{info}</p>
      )}

      {lignes === null ? (
        !erreur && <p>Chargement…</p>
      ) : (
        <>
          {/* Les demandes en attente */}
          <section className="mb-6 rounded-lg bg-white p-4 shadow">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">En attente ({enAttente.length})</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={enAttente.length === 0}
                  onClick={() => void validerTout()}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Tout valider
                </button>
                <button
                  type="button"
                  disabled={cochees.length === 0}
                  onClick={() => void validerSelection(cochees)}
                  className="rounded border border-green-600 px-3 py-1 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Valider la sélection ({cochees.length})
                </button>
                <button
                  type="button"
                  disabled={cochees.length === 0}
                  onClick={() => void refuserSelection(cochees)}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Refuser la sélection
                </button>
              </div>
            </div>

            {enAttente.length === 0 ? (
              <p className="text-sm text-slate-600">
                Aucune demande en attente. Cette page se met à jour toute seule.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {enAttente.map((l) => (
                  <li key={l.id} className="py-3">
                    {enEdition === l.id ? (
                      // Formulaire de correction
                      <form
                        onSubmit={(ev) => void enregistrerCorrection(ev, l.id)}
                        className="space-y-2"
                      >
                        <div className="flex gap-2">
                          <input
                            required
                            value={editPrenom}
                            onChange={(e) => setEditPrenom(e.target.value)}
                            className="w-full rounded border border-slate-300 p-2"
                            aria-label="Prénom"
                          />
                          <input
                            required
                            value={editNom}
                            onChange={(e) => setEditNom(e.target.value)}
                            className="w-full rounded border border-slate-300 p-2"
                            aria-label="Nom"
                          />
                        </div>
                        <input
                          required
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full rounded border border-slate-300 p-2"
                          aria-label="Adresse e-mail"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEnEdition(null)}
                            className="rounded border border-slate-300 px-3 py-1 text-sm"
                          >
                            Annuler
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selection.includes(l.id)}
                          onChange={() => basculerSelection(l.id)}
                          aria-label={`Sélectionner ${l.prenom} ${l.nom}`}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {l.nom} {l.prenom}
                          </p>
                          <p className="text-sm text-slate-600">
                            {l.email} · {l.classe?.nom ?? 'classe non renseignée'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => commencerCorrection(l)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Corriger
                        </button>
                        <button
                          type="button"
                          onClick={() => void validerSelection([l.id])}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Valider
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Les étudiants validés */}
          <section className="mb-6 rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 font-semibold">Validés ({validees.length})</h3>
            {validees.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun étudiant validé pour le moment.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {validees.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">
                        {l.nom} {l.prenom}
                      </p>
                      <p className="text-sm text-slate-600">
                        {l.email} · {l.classe?.nom ?? 'classe non renseignée'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                        {LIBELLES_STATUT_PARTICIPATION[l.statut]}
                      </span>
                      {/* On ne refuse que celui qui n'est pas encore entré */}
                      {l.statut === 'valide' && (
                        <button
                          type="button"
                          onClick={() => void refuserSelection([l.id])}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Refuser
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Les demandes refusées : on peut changer d'avis */}
          {refusees.length > 0 && (
            <section className="mb-6 rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Refusées ({refusees.length})</h3>
              <ul className="divide-y divide-slate-200">
                {refusees.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">
                        {l.nom} {l.prenom}
                      </p>
                      <p className="text-sm text-slate-600">{l.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void validerSelection([l.id])}
                      className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                    >
                      Valider finalement
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Exclus et terminés : à titre d'information */}
          {autres.length > 0 && (
            <section className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Exclus ou terminés ({autres.length})</h3>
              <ul className="divide-y divide-slate-200">
                {autres.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <p>
                      {l.nom} {l.prenom}{' '}
                      <span className="text-sm text-slate-600">· {l.email}</span>
                    </p>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {LIBELLES_STATUT_PARTICIPATION[l.statut]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// La page : elle lit l'évaluation dans l'adresse (/ecole/evaluations/<id>/inscriptions)
// et l'établissement actif. Le « key » donne un contenu tout neuf quand l'un ou l'autre change.
export function PageInscriptions() {
  const { id } = useParams<{ id: string }>();
  const { etablissementActif } = useSession();
  if (!id || !etablissementActif) return null;

  return (
    <ContenuInscriptions
      key={`${etablissementActif.etablissementId}-${id}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
    />
  );
}