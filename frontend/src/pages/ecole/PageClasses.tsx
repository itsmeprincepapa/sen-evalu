import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { creerClasse, listerClasses } from "../../api/classes";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { useSession } from "../../session/SessionContext";
import type { ClasseResume } from "../../types";

// Le contenu de la page, pour UN établissement donné.
function ListeClasses({ idEtablissement }: { idEtablissement: string }) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const navigate = useNavigate();
  const { erreur, setErreur, traiter } = useErreurs();

  const [classes, setClasses] = useState<ClasseResume[] | null>(null);
  const [nom, setNom] = useState("");

  // Charge la liste des classes au départ. Les données arrivent dans une « promesse » :
  // le setState est appelé quand elles sont arrivées, jamais directement dans l'effet.
  useEffect(() => {
    let annule = false; // devient vrai si on quitte la page avant la réponse

    listerClasses(jetonSession, idEtablissement)
      .then((liste) => {
        if (!annule) setClasses(liste);
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });

    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, traiter]);

  // Création : on file ensuite sur la page de la nouvelle classe pour y mettre les étudiants.
  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    try {
      const cree = await creerClasse(jetonSession, idEtablissement, nom.trim());
      navigate(`/ecole/classes/${cree.id}`);
    } catch (e) {
      traiter(e);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Classes" />

      <Link
        to="/"
        className="mb-4 inline-block text-sm text-marque-700 hover:underline"
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

      {/* Créer une classe */}
      <form
        onSubmit={creer}
        className="mb-6 flex items-end gap-3 rounded-lg bg-white p-4 shadow"
      >
        <label className="flex-1">
          <span className="text-sm font-medium">Nouvelle classe</span>
          <input
            required
            placeholder="Exemple : L2 Informatique"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-marque-600 px-4 py-2 font-medium text-white hover:bg-marque-700"
        >
          Créer
        </button>
      </form>

      {/* La liste des classes */}
      {classes === null ? (
        <p>Chargement…</p>
      ) : classes.length === 0 ? (
        <p className="text-slate-600">
          Aucune classe pour le moment. Créez la première ci-dessus.
        </p>
      ) : (
        <ul className="space-y-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                to={`/ecole/classes/${c.id}`}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow hover:bg-slate-50"
              >
                <span className="font-medium">{c.nom}</span>
                <span className="text-sm text-slate-600">
                  {c.nbEtudiants} étudiant{c.nbEtudiants > 1 ? "s" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// La page : elle relit l'établissement actif ; le « key » donne un contenu tout neuf quand
// la personne change d'établissement (on ne voit jamais les classes de l'école précédente).
export function PageClasses() {
  const { etablissementActif } = useSession();
  if (!etablissementActif) return null;

  return (
    <ListeClasses
      key={etablissementActif.etablissementId}
      idEtablissement={etablissementActif.etablissementId}
    />
  );
}
