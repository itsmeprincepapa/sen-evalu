import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { lireCorrection } from "../../api/correction";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { LIBELLES_STATUT_EVALUATION } from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type { EtatCorrection } from "../../types";
import { Alerte } from "../../ui/Alerte";
import { Badge } from "../../ui/Badge";
import { Carte } from "../../ui/Carte";
import { classesBouton } from "../../components/bouton.styles";

interface Props {
  idEtablissement: string;
  idEvaluation: string;
}

// Le contenu de la page, pour UNE évaluation d'UN établissement.
function ContenuResultats({ idEtablissement, idEvaluation }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const { erreur, traiter } = useErreurs();

  const [etat, setEtat] = useState<EtatCorrection | null>(null);

  // Charge les résultats (le serveur prépare les notes des QCM au passage). Les données
  // arrivent dans une « promesse » : le setState est appelé quand elles sont arrivées,
  // jamais directement dans le corps de l'effet.
  useEffect(() => {
    let annule = false;
    lireCorrection(jetonSession, idEtablissement, idEvaluation)
      .then((donnees) => {
        if (!annule) setEtat(donnees);
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idEvaluation, traiter]);

  // La première copie qui attend encore une correction.
  const aCorriger = etat?.copies.find((c) => !c.corrigee) ?? null;
  const base = `/ecole/evaluations/${idEvaluation}/correction`;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <EnteteSession titre="Résultats et correction" />

      <Link
        to="/ecole/evaluations"
        className="mb-4 inline-block text-sm text-marque-700 hover:underline"
      >
        ← Retour à mes évaluations
      </Link>

      {erreur && <Alerte type="erreur" className="mb-4">{erreur}</Alerte>}

      {etat === null ? (
        !erreur && <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          {/* --- En-tête : titre, état, compteur --- */}
          <Carte>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {etat.evaluation.titre}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  État :{" "}
                  {LIBELLES_STATUT_EVALUATION[etat.evaluation.statut] ??
                    etat.evaluation.statut}
                  {" · "}Barème : {etat.evaluation.totalPoints} point
                  {etat.evaluation.totalPoints > 1 ? "s" : ""}
                </p>
                <p className="mt-2 text-xl font-bold text-slate-900">
                  {etat.compteurs.corrigees} corrigée
                  {etat.compteurs.corrigees > 1 ? "s" : ""} sur {etat.compteurs.total}
                </p>
              </div>
              {aCorriger && (
                <Link
                  to={`${base}/${aCorriger.participationId}`}
                  className={classesBouton("primaire", "m")}
                >
                  Corriger la prochaine copie
                </Link>
              )}
            </div>
          </Carte>

          {etat.copies.length === 0 ? (
            <Alerte type="info">
              Aucun étudiant n’a passé cette évaluation : il n’y a aucune copie à
              corriger.
            </Alerte>
          ) : (
            <Carte className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 font-medium">Étudiant</th>
                    <th className="py-2 pr-3 font-medium">Passage</th>
                    <th className="py-2 pr-3 font-medium">QCM</th>
                    <th className="py-2 pr-3 font-medium">Note totale</th>
                    <th className="py-2 pr-3 font-medium">Correction</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {etat.copies.map((c) => (
                    <tr key={c.participationId} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">
                          {c.prenom} {c.nom}
                        </div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </td>
                      <td className="py-2 pr-3">
                        {c.statut === "exclu" ? (
                          <Badge ton="danger">Exclu</Badge>
                        ) : (
                          <Badge ton="neutre">Terminé</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono">{c.noteQcm}</td>
                      <td className="py-2 pr-3 font-mono">
                        {c.noteTotale} / {etat.evaluation.totalPoints}
                      </td>
                      <td className="py-2 pr-3">
                        {c.corrigee ? (
                          <Badge ton="succes">Corrigée</Badge>
                        ) : (
                          <Badge ton="attention">
                            {c.nbACorriger} à corriger
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          to={`${base}/${c.participationId}`}
                          className={classesBouton("secondaire", "s")}
                        >
                          {c.corrigee ? "Revoir" : "Corriger"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}

// La page : elle lit l'établissement actif et l'évaluation dans l'adresse. Le « key » donne
// un contenu tout neuf quand la personne change d'école ou d'évaluation.
export function PageResultats() {
  const { etablissementActif } = useSession();
  const { id } = useParams<{ id: string }>();
  if (!etablissementActif || !id) return null;

  return (
    <ContenuResultats
      key={`${etablissementActif.etablissementId}-${id}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
    />
  );
}