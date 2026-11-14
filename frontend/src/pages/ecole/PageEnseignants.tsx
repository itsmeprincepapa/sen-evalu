
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErreurApi, ErreurReseau } from '../../api/http';
import {
  changerAccesEnseignant,
  inviterEnseignant,
  listerEnseignants,
} from '../../api/ecole';
import { EnteteSession } from '../../components/EnteteSession';
import { useSession } from '../../session/SessionContext';
import type { Enseignant } from '../../types';

interface PropsListe {
  idEtablissement: string;
  nomEtablissement: string;
}

function ListeEnseignants({
  idEtablissement,
  nomEtablissement,
}: PropsListe) {
  const { jeton, deconnecter } = useSession();
  const jetonSession = jeton ?? '';

  const [liste, setListe] = useState<Enseignant[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  // Formulaire d'invitation
  const [email, setEmail] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');

  // Gestion centralisée des erreurs
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

      setErreur(
        e instanceof Error
          ? e.message
          : 'Une erreur est survenue.',
      );
    },
    [deconnecter],
  );

  // Chargement des enseignants
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const enseignants = await listerEnseignants(
        jetonSession,
        idEtablissement,
      );

      setListe(enseignants);
    } catch (e) {
      traiterErreur(e);
    } finally {
      setChargement(false);
    }
  }, [jetonSession, idEtablissement, traiterErreur]);

  // Chargement initial sans appel direct à setState dans l'effet
  useEffect(() => {
    let actif = true;

    async function chargerInitialement() {
      try {
        const enseignants = await listerEnseignants(
          jetonSession,
          idEtablissement,
        );

        if (actif) {
          setListe(enseignants);
        }
      } catch (e) {
        if (actif) {
          traiterErreur(e);
        }
      }
    }

    void chargerInitialement();

    return () => {
      actif = false;
    };
  }, [jetonSession, idEtablissement, traiterErreur]);

  // Invitation d'un enseignant
  async function inviter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    setErreur(null);
    setInfo(null);

    try {
      await inviterEnseignant(jetonSession, idEtablissement, {
        email: email.trim(),
        nom: nom.trim(),
        prenom: prenom.trim(),
      });

      setEmail('');
      setPrenom('');
      setNom('');

      setInfo(
        'Enseignant ajouté : il pourra se connecter avec ce compte Google.',
      );

      await charger();
    } catch (e) {
      traiterErreur(e);
    }
  }

  // Retirer ou rétablir l'accès
  async function changerAcces(e: Enseignant) {
    const retrait = e.actif;

    if (
      retrait &&
      !window.confirm(
        `Retirer l’accès de ${e.prenom} ${e.nom} ?\n\n` +
          `Cette personne ne pourra plus travailler dans « ${nomEtablissement} ». ` +
          'Ses évaluations restent conservées.',
      )
    ) {
      return;
    }

    setErreur(null);
    setInfo(null);

    try {
      await changerAccesEnseignant(
        jetonSession,
        idEtablissement,
        e.membreId,
        !retrait,
      );

      await charger();
    } catch (err) {
      traiterErreur(err);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Enseignants" />

      <Link
        to="/"
        className="mb-4 inline-block text-sm text-blue-700 hover:underline"
      >
        ← Retour à l’accueil
      </Link>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700"
        >
          {erreur}
        </p>
      )}

      {info && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
          {info}
        </p>
      )}

      {/* Formulaire d'invitation */}
      <form
        onSubmit={inviter}
        className="mb-6 space-y-3 rounded-lg bg-white p-4 shadow"
      >
        <h2 className="font-semibold">Inviter un enseignant</h2>

        <input
          required
          type="email"
          placeholder="Adresse Google de l’enseignant"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-slate-300 p-2"
        />

        <div className="flex gap-3">
          <input
            required
            placeholder="Prénom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className="w-full rounded border border-slate-300 p-2"
          />

          <input
            required
            placeholder="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded border border-slate-300 p-2"
          />
        </div>

        <button
          type="submit"
          disabled={chargement}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Inviter
        </button>
      </form>

      {/* Liste des enseignants */}
      {liste === null ? (
        <p>Chargement des enseignants…</p>
      ) : chargement ? (
        <p className="mb-3 text-sm text-slate-500">
          Actualisation de la liste…
        </p>
      ) : liste.length === 0 ? (
        <p className="text-slate-600">
          Aucun enseignant pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {liste.map((e) => (
            <li
              key={e.membreId}
              className={`flex items-center justify-between gap-4 rounded-lg bg-white p-4 shadow ${
                e.actif ? '' : 'opacity-60'
              }`}
            >
              <div>
                <p className="font-medium">
                  {e.prenom} {e.nom}
                </p>

                <p className="text-sm text-slate-600">
                  {e.email}
                </p>

                <p className="text-xs text-slate-500">
                  {e.actif ? '' : 'Accès retiré · '}
                  {e.dejaConnecte
                    ? 'S’est déjà connecté'
                    : 'Ne s’est pas encore connecté'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void changerAcces(e)}
                disabled={chargement}
                className={`rounded border px-3 py-1 text-sm disabled:opacity-50 ${
                  e.actif
                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                    : 'border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                {e.actif ? 'Retirer l’accès' : 'Rétablir l’accès'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PageEnseignants() {
  const { etablissementActif } = useSession();

  if (!etablissementActif) return null;

  return (
    <ListeEnseignants
      key={etablissementActif.etablissementId}
      idEtablissement={etablissementActif.etablissementId}
      nomEtablissement={etablissementActif.nom}
    />
  );
}
