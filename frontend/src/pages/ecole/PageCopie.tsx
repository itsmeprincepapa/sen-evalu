import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { lireCopie, noterQuestion } from "../../api/correction";
import { classesBouton } from "../../components/bouton.styles";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { LIBELLES_TYPE_QUESTION } from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type { CopieACorriger, QuestionDeCopie } from "../../types";
import { Alerte } from "../../ui/Alerte";
import { Badge } from "../../ui/Badge";
import { Bouton } from "../../ui/Bouton";
import { Carte } from "../../ui/Carte";

// L'éditeur Monaco est lourd : on ne le télécharge QUE lorsqu'une réponse de code s'affiche.
const EditeurCode = lazy(() => import("../../components/EditeurCode"));

// La note et le commentaire en cours de saisie pour une question (du texte : c'est ce que
// manipulent les champs HTML).
interface Saisie {
  note: string;
  commentaire: string;
}

// Valeur de départ d'une saisie : ce qui est déjà enregistré (une note vide reste vide,
// sauf une réponse vide qui reçoit 0 d'office).
function saisieDe(question: QuestionDeCopie): Saisie {
  return {
    note: question.note === null ? "" : String(question.note),
    commentaire: question.commentaire ?? "",
  };
}

// Vérifie une note saisie (0 aux points de la question, deux décimales au plus).
function lireNote(texte: string, points: number): number {
  const note = Number(texte.replace(",", "."));
  if (
    texte.trim() === "" ||
    !Number.isFinite(note) ||
    note < 0 ||
    note > points ||
    Math.round(note * 100) / 100 !== note
  ) {
    throw new Error(
      `La note doit être un nombre de 0 à ${points}, avec deux décimales au plus.`,
    );
  }
  return note;
}

interface Props {
  idEtablissement: string;
  idEvaluation: string;
  idCopie: string;
}

// Le contenu de la page, pour UNE copie d'UNE évaluation.
function ContenuCopie({ idEtablissement, idEvaluation, idCopie }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const navigate = useNavigate();
  const { erreur, setErreur, traiter } = useErreurs();

  const [donnees, setDonnees] = useState<CopieACorriger | null>(null);
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({});
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null); // question en cours d'envoi

  // Charge la copie. Les données arrivent dans une « promesse » : le setState est appelé
  // quand elles sont arrivées, jamais directement dans le corps de l'effet.
  useEffect(() => {
    let annule = false;
    lireCopie(jetonSession, idEtablissement, idEvaluation, idCopie)
      .then((copie) => {
        if (annule) return;
        setDonnees(copie);
        setSaisies(
          Object.fromEntries(copie.questions.map((q) => [q.questionId, saisieDe(q)])),
        );
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idEvaluation, idCopie, traiter]);

  const base = `/ecole/evaluations/${idEvaluation}/correction`;

  // Change la saisie d'UNE question.
  function changer(questionId: string, maj: Partial<Saisie>) {
    setSaisies((avant) => ({
      ...avant,
      [questionId]: { ...avant[questionId], ...maj },
    }));
  }

  // Enregistre la note et le commentaire d'UNE question.
  async function enregistrer(question: QuestionDeCopie) {
    setErreur(null);
    setInfo(null);
    const saisie = saisies[question.questionId];
    setEnCours(question.questionId);
    try {
      const note = lireNote(saisie.note, question.points);
      const resultat = await noterQuestion(
        jetonSession,
        idEtablissement,
        idEvaluation,
        idCopie,
        question.questionId,
        note,
        saisie.commentaire,
      );
      // On met l'écran à jour avec ce que le serveur a calculé (total, compteur, statut).
      setDonnees((avant) =>
        avant
          ? {
              ...avant,
              evaluation: { ...avant.evaluation, statut: resultat.statutEvaluation },
              copie: { ...avant.copie, ...resultat.copie },
              prochaineACorriger: resultat.prochaineACorriger,
              questions: avant.questions.map((q) =>
                q.questionId === question.questionId
                  ? { ...q, note: resultat.note, commentaire: resultat.commentaire }
                  : q,
              ),
            }
          : avant,
      );
      setSaisies((avant) => ({
        ...avant,
        [question.questionId]: {
          note: String(resultat.note),
          commentaire: resultat.commentaire ?? "",
        },
      }));
      setCompteurs(resultat.compteurs);
      setInfo(
        resultat.copie.corrigee
          ? "Note enregistrée : cette copie est entièrement corrigée."
          : "Note enregistrée.",
      );
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(null);
    }
  }

  // Le compteur « N corrigées sur M » (mis à jour à chaque note enregistrée).
  const [compteurs, setCompteurs] = useState<{ corrigees: number; total: number } | null>(
    null,
  );

  const lien = (id: string | null) => (id ? `${base}/${id}` : null);

  return (
    <div className="mx-auto max-w-4xl p-4">
      <EnteteSession titre="Correction d’une copie" />

      <Link to={base} className="mb-4 inline-block text-sm text-marque-700 hover:underline">
        ← Retour aux résultats
      </Link>

      {erreur && <Alerte type="erreur" className="mb-4">{erreur}</Alerte>}
      {info && <Alerte type="succes" className="mb-4">{info}</Alerte>}

      {donnees === null ? (
        !erreur && <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          {/* --- En-tête : l'étudiant, la note, la navigation --- */}
          <Carte className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">
                  {donnees.evaluation.titre} · Copie {donnees.copie.numero} sur{" "}
                  {donnees.copie.total}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {donnees.copie.prenom} {donnees.copie.nom}
                </h2>
                <p className="text-sm text-slate-500">{donnees.copie.email}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">
                  {donnees.copie.noteTotale} / {donnees.evaluation.totalPoints}
                </p>
                {donnees.copie.corrigee ? (
                  <Badge ton="succes">Corrigée</Badge>
                ) : (
                  <Badge ton="attention">{donnees.copie.nbACorriger} à corriger</Badge>
                )}
                {compteurs && (
                  <p className="mt-1 text-xs text-slate-500">
                    {compteurs.corrigees} corrigée{compteurs.corrigees > 1 ? "s" : ""} sur{" "}
                    {compteurs.total}
                  </p>
                )}
              </div>
            </div>

            {donnees.copie.statut === "exclu" && (
              <Alerte type="attention">
                Cet étudiant a été exclu ({donnees.copie.nbIncidentsGraves} incident
                {donnees.copie.nbIncidentsGraves > 1 ? "s" : ""} grave
                {donnees.copie.nbIncidentsGraves > 1 ? "s" : ""}) et n’a pas été
                réintégré : sa copie est corrigée telle quelle.
              </Alerte>
            )}

            <div className="flex flex-wrap gap-2">
              <Bouton
                variante="secondaire"
                taille="s"
                disabled={!donnees.precedente}
                onClick={() => {
                  const cible = lien(donnees.precedente);
                  if (cible) void navigate(cible);
                }}
              >
                ← Copie précédente
              </Bouton>
              <Bouton
                variante="secondaire"
                taille="s"
                disabled={!donnees.suivante}
                onClick={() => {
                  const cible = lien(donnees.suivante);
                  if (cible) void navigate(cible);
                }}
              >
                Copie suivante →
              </Bouton>
              <Bouton
                taille="s"
                disabled={!donnees.prochaineACorriger}
                onClick={() => {
                  const cible = lien(donnees.prochaineACorriger);
                  if (cible) void navigate(cible);
                }}
              >
                Prochaine à corriger
              </Bouton>
            </div>
          </Carte>

          {/* --- Les questions --- */}
          {donnees.questions.map((q) => {
            const saisie = saisies[q.questionId] ?? saisieDe(q);
            const modifiee = saisie.note !== (q.note === null ? "" : String(q.note)) ||
              saisie.commentaire !== (q.commentaire ?? "");
            return (
              <Carte key={q.questionId} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Question {q.ordre} · {LIBELLES_TYPE_QUESTION[q.type] ?? q.type}
                  </p>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {q.points} point{q.points > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-slate-900">{q.enonce}</p>

                {/* --- QCM : bonnes réponses et réponses de l'étudiant --- */}
                {q.options && (
                  <>
                    <ul className="space-y-1 text-sm">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className={`flex flex-wrap items-center gap-2 rounded border p-2 ${
                            o.cochee && o.correcte
                              ? "border-green-300 bg-green-50"
                              : o.cochee
                                ? "border-red-300 bg-red-50"
                                : o.correcte
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-slate-200"
                          }`}
                        >
                          <span>{o.texte}</span>
                          {o.correcte && <Badge ton="succes">Bonne réponse</Badge>}
                          {o.cochee && <Badge ton="info">Cochée par l’étudiant</Badge>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-slate-700">
                      Note automatique : <strong>{q.note ?? 0}</strong> / {q.points}
                      {q.vide && " (aucune réponse cochée)"}
                    </p>
                  </>
                )}

                {/* --- Réponse écrite ou programme --- */}
                {!q.options && (
                  <>
                    {q.vide ? (
                      <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
                        L’étudiant n’a rien répondu : 0 point d’office (vous pouvez le
                        modifier ci-dessous).
                      </p>
                    ) : q.type === "code" ? (
                      <div>
                        <p className="mb-1 text-sm text-slate-600">
                          Programme de l’étudiant ({q.langage}) :
                        </p>
                        <Suspense
                          fallback={
                            <p className="p-3 text-sm text-slate-500">
                              Chargement de l’éditeur…
                            </p>
                          }
                        >
                          <EditeurCode
                            valeur={q.reponse ?? ""}
                            langage={q.langage ?? "plaintext"}
                            lectureSeule
                            hauteur="260px"
                          />
                        </Suspense>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
                        {q.reponse}
                      </p>
                    )}

                    {/* --- Note et commentaire --- */}
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <label
                          htmlFor={`note-${q.questionId}`}
                          className="block text-sm font-medium text-slate-700"
                        >
                          Note (sur {q.points})
                        </label>
                        <input
                          id={`note-${q.questionId}`}
                          type="text"
                          inputMode="decimal"
                          value={saisie.note}
                          onChange={(e) => changer(q.questionId, { note: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label
                          htmlFor={`commentaire-${q.questionId}`}
                          className="block text-sm font-medium text-slate-700"
                        >
                          Commentaire (facultatif)
                        </label>
                        <textarea
                          id={`commentaire-${q.questionId}`}
                          value={saisie.commentaire}
                          onChange={(e) =>
                            changer(q.questionId, { commentaire: e.target.value })
                          }
                          rows={2}
                          maxLength={2000}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Bouton
                        disabled={enCours !== null || (!modifiee && q.note !== null)}
                        onClick={() => void enregistrer(q)}
                      >
                        {enCours === q.questionId ? "Enregistrement…" : "Enregistrer la note"}
                      </Bouton>
                      {q.note === null ? (
                        <Badge ton="attention">À noter</Badge>
                      ) : modifiee ? (
                        <Badge ton="attention">Modifications non enregistrées</Badge>
                      ) : (
                        <Badge ton="succes">Note enregistrée</Badge>
                      )}
                    </div>
                  </>
                )}
              </Carte>
            );
          })}

          {/* --- Pied de page : enchaîner les copies --- */}
          <div className="flex flex-wrap justify-between gap-3">
            <Link to={base} className={classesBouton("secondaire", "m")}>
              Retour aux résultats
            </Link>
            {donnees.prochaineACorriger ? (
              <Link
                to={`${base}/${donnees.prochaineACorriger}`}
                className={classesBouton("primaire", "m")}
              >
                Prochaine copie à corriger →
              </Link>
            ) : (
              <p className="self-center text-sm text-slate-600">
                Il n’y a plus d’autre copie à corriger.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// La page : elle lit l'établissement actif, l'évaluation et la copie dans l'adresse. Le
// « key » donne un contenu tout neuf quand la personne change d'école ou de copie : les
// champs de note repartent alors de ce qui est enregistré pour la nouvelle copie.
export function PageCopie() {
  const { etablissementActif } = useSession();
  const { id, participationId } = useParams<{
    id: string;
    participationId: string;
  }>();
  if (!etablissementActif || !id || !participationId) return null;

  return (
    <ContenuCopie
      key={`${etablissementActif.etablissementId}-${id}-${participationId}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
      idCopie={participationId}
    />
  );
}