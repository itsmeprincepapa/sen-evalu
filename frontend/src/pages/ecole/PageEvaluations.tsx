import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listerMesEvaluations } from "../../api/evaluations";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { LIBELLES_STATUT_EVALUATION } from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type { EvaluationEnseignant } from "../../types";

// Le contenu de la page, pour UN établissement donné.
function ListeEvaluations({ idEtablissement }: { idEtablissement: string }) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const { erreur, traiter } = useErreurs();

  const [evaluations, setEvaluations] = useState<EvaluationEnseignant[] | null>(
    null,
  );
  const [copie, setCopie] = useState<string | null>(null); // lien dont l'adresse vient d'être copiée

  // Charge la liste. Les données arrivent dans une « promesse » : le setState est appelé
  // quand elles sont arrivées, jamais directement dans le corps de l'effet.
  useEffect(() => {
    let annule = false;
    listerMesEvaluations(jetonSession, idEtablissement)
      .then((liste) => {
        if (!annule) setEvaluations(liste);
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, traiter]);

  // L'adresse complète à donner aux étudiants.
  const adresse = (lien: string) => `${window.location.origin}/e/${lien}`;

  async function copier(lien: string) {
    try {
      await navigator.clipboard.writeText(adresse(lien));
      setCopie(lien);
    } catch {
      // Copie impossible : le champ contenant l'adresse reste sélectionnable à la main.
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Mes évaluations" />

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

      {evaluations === null ? (
        <p>Chargement…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-slate-600">
          Aucune évaluation pour le moment. (La création arrive à l’étape
          suivante.)
        </p>
      ) : (
        <ul className="space-y-4">
          {evaluations.map((e) => {
            const enAttente = e.comptes["en_attente"] ?? 0;
            const validees =
              (e.comptes["valide"] ?? 0) + (e.comptes["en_cours"] ?? 0);
            return (
              <li key={e.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{e.titre}</h2>
                    <p className="text-sm text-slate-600">
                      {new Date(e.debut).toLocaleString("fr-FR")} →{" "}
                      {new Date(e.fin).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {LIBELLES_STATUT_EVALUATION[e.statut] ?? e.statut}
                  </span>
                </div>

                {/* Le lien à donner aux étudiants */}
                <div className="mt-3 flex gap-2">
                  <input
                    readOnly
                    value={adresse(e.lien)}
                    onFocus={(ev) => ev.currentTarget.select()}
                    className="flex-1 rounded border border-slate-300 bg-slate-50 p-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void copier(e.lien)}
                    className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    {copie === e.lien ? "Copié !" : "Copier"}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {enAttente > 0 ? (
                      <strong className="text-orange-700">
                        {enAttente} en attente
                      </strong>
                    ) : (
                      "Aucune demande en attente"
                    )}{" "}
                    · {validees} validé{validees > 1 ? "s" : ""}
                  </p>
                  <Link
                    to={`/ecole/evaluations/${e.id}/inscriptions`}
                    className="rounded bg-marque-600 px-4 py-2 text-sm text-white hover:bg-marque-700"
                  >
                    Inscriptions
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// La page : elle relit l'établissement actif ; le « key » donne un contenu tout neuf quand
// la personne change d'établissement.
export function PageEvaluations() {
  const { etablissementActif } = useSession();
  if (!etablissementActif) return null;

  return (
    <ListeEvaluations
      key={etablissementActif.etablissementId}
      idEtablissement={etablissementActif.etablissementId}
    />
  );
}
