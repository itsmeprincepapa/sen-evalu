import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { lireEvaluation } from "../../api/evaluations";
import {
  creerQuestion,
  listerQuestions,
  modifierQuestion,
  reordonnerQuestions,
  supprimerQuestion,
} from "../../api/questions";
import { ChampReponse } from "../../components/ChampReponse";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { LANGAGES } from "../../lib/langages";
import { LIBELLES_TYPE_QUESTION } from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type {
  Contenu,
  DetailEvaluation,
  DonneesQuestion,
  ListeQuestions,
  QuestionEnseignant,
  TypeQuestion,
} from "../../types";
import { Alerte } from "../../ui/Alerte";
import { Bouton } from "../../ui/Bouton";
import { Carte } from "../../ui/Carte";
import { Champ } from "../../ui/Champ";

// Une proposition de QCM telle qu'elle est saisie dans le formulaire.
interface PropositionForm {
  texte: string;
  correcte: boolean;
}

// Les champs du formulaire d'une question (les nombres restent du texte jusqu'à l'envoi).
interface FormulaireQuestion {
  type: TypeQuestion;
  enonce: string;
  points: string;
  langage: string;
  options: PropositionForm[];
}

// Deux propositions vides, la première cochée : le minimum d'un QCM.
const deuxPropositions = (): PropositionForm[] => [
  { texte: "", correcte: true },
  { texte: "", correcte: false },
];

function formulaireVide(): FormulaireQuestion {
  return {
    type: "qcm_unique",
    enonce: "",
    points: "1",
    langage: LANGAGES[0].id,
    options: deuxPropositions(),
  };
}

// Remplit le formulaire avec une question existante.
function versFormulaire(q: QuestionEnseignant): FormulaireQuestion {
  return {
    type: q.type,
    enonce: q.enonce,
    points: String(q.points),
    langage: q.langage ?? LANGAGES[0].id,
    options: q.options
      ? q.options.map((o) => ({ texte: o.texte, correcte: o.correcte }))
      : deuxPropositions(),
  };
}

const estQcm = (type: TypeQuestion) =>
  type === "qcm_unique" || type === "qcm_multiple";

// Transforme le formulaire en données pour le serveur, en vérifiant les règles de chaque
// type. (Le serveur les revérifie : ici, c'est pour donner un message clair tout de suite.)
function versDonnees(f: FormulaireQuestion): DonneesQuestion {
  const enonce = f.enonce.trim();
  if (enonce === "") throw new Error("L'énoncé ne peut pas être vide.");

  const points = Number(f.points.replace(",", "."));
  if (
    f.points.trim() === "" ||
    !Number.isFinite(points) ||
    points <= 0 ||
    points > 100 ||
    Math.round(points * 100) / 100 !== points
  ) {
    throw new Error(
      "Les points doivent être un nombre supérieur à 0 (100 au maximum), avec deux décimales au plus.",
    );
  }

  if (estQcm(f.type)) {
    const options = f.options.map((o) => ({
      texte: o.texte.trim(),
      correcte: o.correcte,
    }));
    if (options.length < 2) throw new Error("Un QCM demande au moins 2 propositions.");
    if (options.some((o) => o.texte === "")) {
      throw new Error("Chaque proposition doit avoir un texte.");
    }
    const bonnes = options.filter((o) => o.correcte).length;
    if (f.type === "qcm_unique" && bonnes !== 1) {
      throw new Error("Un QCM à une seule réponse demande exactement une bonne réponse.");
    }
    if (f.type === "qcm_multiple" && bonnes < 1) {
      throw new Error("Cochez au moins une bonne réponse.");
    }
    return { type: f.type, enonce, points, langage: null, options };
  }

  if (f.type === "code") {
    return { type: f.type, enonce, points, langage: f.langage, options: null };
  }
  return { type: f.type, enonce, points, langage: null, options: null };
}

interface PropsEditeur {
  titre: string;
  formulaire: FormulaireQuestion;
  onChange: (f: FormulaireQuestion) => void;
  onEnregistrer: (ev: FormEvent) => void;
  onAnnuler: () => void;
  enCours: boolean;
}

// Le formulaire d'une question (création ou modification).
function EditeurQuestion({
  titre,
  formulaire,
  onChange,
  onEnregistrer,
  onAnnuler,
  enCours,
}: PropsEditeur) {
  const qcm = estQcm(formulaire.type);
  const unique = formulaire.type === "qcm_unique";

  function changerType(type: TypeQuestion) {
    let options = formulaire.options;
    if (type === "qcm_unique") {
      // Une seule bonne réponse possible : on garde la première cochée.
      const premiere = options.findIndex((o) => o.correcte);
      const gardee = premiere === -1 ? 0 : premiere;
      options = options.map((o, i) => ({ ...o, correcte: i === gardee }));
    }
    onChange({ ...formulaire, type, options });
  }

  // Coche la bonne réponse : une seule (QCM unique) ou plusieurs (QCM multiple).
  function basculerBonne(index: number) {
    onChange({
      ...formulaire,
      options: formulaire.options.map((o, i) =>
        unique ? { ...o, correcte: i === index } : i === index ? { ...o, correcte: !o.correcte } : o,
      ),
    });
  }

  function changerTexte(index: number, texte: string) {
    onChange({
      ...formulaire,
      options: formulaire.options.map((o, i) => (i === index ? { ...o, texte } : o)),
    });
  }

  function ajouterProposition() {
    onChange({
      ...formulaire,
      options: [...formulaire.options, { texte: "", correcte: false }],
    });
  }

  function retirerProposition(index: number) {
    onChange({
      ...formulaire,
      options: formulaire.options.filter((_, i) => i !== index),
    });
  }

  return (
    <form onSubmit={onEnregistrer}>
      <Carte className="space-y-4 ring-marque-300">
        <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>

        <div>
          <label htmlFor="type-question" className="block text-sm font-medium text-slate-700">
            Type de question
          </label>
          <select
            id="type-question"
            value={formulaire.type}
            onChange={(e) => changerType(e.target.value as TypeQuestion)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
          >
            {Object.entries(LIBELLES_TYPE_QUESTION).map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="enonce-question" className="block text-sm font-medium text-slate-700">
            Énoncé
          </label>
          <textarea
            id="enonce-question"
            value={formulaire.enonce}
            onChange={(e) => onChange({ ...formulaire, enonce: e.target.value })}
            rows={4}
            maxLength={10000}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
          />
        </div>

        <Champ
          libelle="Points"
          aide="Supérieurs à 0, deux décimales au plus (par exemple 1,5)."
          type="text"
          inputMode="decimal"
          value={formulaire.points}
          onChange={(e) => onChange({ ...formulaire, points: e.target.value })}
        />

        {/* --- QCM : les propositions --- */}
        {qcm && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Propositions</p>
            <p className="text-xs text-slate-500">
              {unique
                ? "Cochez LA bonne réponse."
                : "Cochez TOUTES les bonnes réponses. Tout ou rien : les points sont donnés seulement si toutes les bonnes réponses sont cochées et aucune mauvaise."}
            </p>
            {formulaire.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={unique ? "radio" : "checkbox"}
                  name="bonne-reponse"
                  checked={o.correcte}
                  onChange={() => basculerBonne(i)}
                  aria-label={`La proposition ${i + 1} est correcte`}
                  className="h-4 w-4 accent-marque-600"
                />
                <input
                  type="text"
                  value={o.texte}
                  onChange={(e) => changerTexte(i, e.target.value)}
                  maxLength={500}
                  placeholder={`Proposition ${i + 1}`}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
                />
                <Bouton
                  variante="discret"
                  taille="s"
                  disabled={formulaire.options.length <= 2}
                  onClick={() => retirerProposition(i)}
                >
                  Retirer
                </Bouton>
              </div>
            ))}
            <Bouton
              variante="secondaire"
              taille="s"
              disabled={formulaire.options.length >= 10}
              onClick={ajouterProposition}
            >
              Ajouter une proposition
            </Bouton>
          </div>
        )}

        {/* --- Code : le langage --- */}
        {formulaire.type === "code" && (
          <div>
            <label htmlFor="langage-question" className="block text-sm font-medium text-slate-700">
              Langage de programmation
            </label>
            <select
              id="langage-question"
              value={formulaire.langage}
              onChange={(e) => onChange({ ...formulaire, langage: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-marque-600 focus:outline-none focus:ring-2 focus:ring-marque-200"
            >
              {LANGAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              L’étudiant écrit son programme dans un éditeur (couleurs, indentation) mais
              ne peut pas l’exécuter. Vous le corrigez à la main.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Bouton type="submit" disabled={enCours}>
            Enregistrer la question
          </Bouton>
          <Bouton variante="secondaire" onClick={onAnnuler}>
            Annuler
          </Bouton>
        </div>
      </Carte>
    </form>
  );
}

interface Props {
  idEtablissement: string;
  idEvaluation: string;
}

// Le contenu de la page, pour UNE évaluation d'UN établissement.
function ContenuQuestions({ idEtablissement, idEvaluation }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const { erreur, setErreur, traiter } = useErreurs();

  const [detail, setDetail] = useState<DetailEvaluation | null>(null);
  const [liste, setListe] = useState<ListeQuestions | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // La question en cours de saisie : id = null pour une nouvelle question.
  const [edition, setEdition] = useState<{
    id: string | null;
    formulaire: FormulaireQuestion;
  } | null>(null);

  // L'aperçu « côté étudiant » et les réponses essayées dedans (rien n'est enregistré).
  const [apercu, setApercu] = useState(false);
  const [reponsesApercu, setReponsesApercu] = useState<Record<string, Contenu>>({});

  // Charge l'évaluation et ses questions. Les données arrivent dans une « promesse » :
  // le setState est appelé quand elles sont arrivées, jamais directement dans l'effet.
  useEffect(() => {
    let annule = false;
    Promise.all([
      lireEvaluation(jetonSession, idEtablissement, idEvaluation),
      listerQuestions(jetonSession, idEtablissement, idEvaluation),
    ])
      .then(([d, l]) => {
        if (annule) return;
        setDetail(d);
        setListe(l);
      })
      .catch((e: unknown) => {
        if (!annule) traiter(e);
      });
    return () => {
      annule = true;
    };
  }, [jetonSession, idEtablissement, idEvaluation, traiter]);

  // Exécute une action : efface les anciens messages, bloque les boutons pendant l'envoi,
  // et affiche l'erreur éventuelle.
  async function executer(travail: () => Promise<void>, succes?: string) {
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      await travail();
      if (succes) setInfo(succes);
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function enregistrer(ev: FormEvent) {
    ev.preventDefault();
    if (!edition) return;
    void executer(async () => {
      const donnees = versDonnees(edition.formulaire);
      if (edition.id) {
        await modifierQuestion(jetonSession, idEtablissement, idEvaluation, edition.id, donnees);
      } else {
        await creerQuestion(jetonSession, idEtablissement, idEvaluation, donnees);
      }
      setListe(await listerQuestions(jetonSession, idEtablissement, idEvaluation));
      setEdition(null);
    }, "Question enregistrée.");
  }

  function supprimer(q: QuestionEnseignant) {
    if (!window.confirm(`Supprimer la question ${q.ordre} ? Cette action est définitive.`)) {
      return;
    }
    void executer(async () => {
      await supprimerQuestion(jetonSession, idEtablissement, idEvaluation, q.id);
      setListe(await listerQuestions(jetonSession, idEtablissement, idEvaluation));
      if (edition?.id === q.id) setEdition(null);
    }, "Question supprimée.");
  }

  // Échange une question avec sa voisine (sens = -1 : monter, +1 : descendre).
  function deplacer(index: number, sens: -1 | 1) {
    if (!liste) return;
    const ids = liste.questions.map((q) => q.id);
    const cible = index + sens;
    if (cible < 0 || cible >= ids.length) return;
    [ids[index], ids[cible]] = [ids[cible], ids[index]];
    void executer(async () => {
      setListe(await reordonnerQuestions(jetonSession, idEtablissement, idEvaluation, ids));
    });
  }

  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <EnteteSession titre="Questions de l’évaluation" />

      <Link
        to={`/ecole/evaluations/${idEvaluation}/modifier`}
        className="mb-4 inline-block text-sm text-marque-700 hover:underline"
      >
        ← Retour à l’évaluation
      </Link>

      {erreur && <Alerte type="erreur" className="mb-4">{erreur}</Alerte>}
      {info && <Alerte type="succes" className="mb-4">{info}</Alerte>}

      {detail === null || liste === null ? (
        <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          {/* --- Résumé : titre, nombre de questions, total des points --- */}
          <Carte>
            <h2 className="text-lg font-semibold text-slate-900">{detail.titre}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {pluriel(liste.questions.length, "question")} · Total :{" "}
              <strong>{pluriel(liste.totalPoints, "point")}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {detail.modifiable && (
                <Bouton
                  disabled={enCours}
                  onClick={() => setEdition({ id: null, formulaire: formulaireVide() })}
                >
                  Ajouter une question
                </Bouton>
              )}
              <Bouton
                variante="secondaire"
                disabled={liste.questions.length === 0}
                onClick={() => setApercu((v) => !v)}
              >
                {apercu ? "Masquer l'aperçu" : "Aperçu côté étudiant"}
              </Bouton>
            </div>
          </Carte>

          {!detail.modifiable && (
            <Alerte type="info">
              L’évaluation a commencé : les questions ne peuvent plus être modifiées.
            </Alerte>
          )}

          {liste.questions.length === 0 && edition === null && (
            <p className="text-slate-600">
              Aucune question pour le moment.
              {detail.modifiable && " Cliquez sur « Ajouter une question »."}
            </p>
          )}

          {/* --- Les questions dans l'ordre (la question en cours de saisie devient un formulaire) --- */}
          {liste.questions.map((q, index) =>
            edition?.id === q.id ? (
              <EditeurQuestion
                key={q.id}
                titre={`Modifier la question ${q.ordre}`}
                formulaire={edition.formulaire}
                onChange={(formulaire) => setEdition({ id: q.id, formulaire })}
                onEnregistrer={enregistrer}
                onAnnuler={() => setEdition(null)}
                enCours={enCours}
              />
            ) : (
              <Carte key={q.id}>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-slate-500">
                    Question {q.ordre} · {LIBELLES_TYPE_QUESTION[q.type] ?? q.type}
                  </p>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {pluriel(q.points, "point")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-900">{q.enonce}</p>

                {q.options && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {q.options.map((o) => (
                      <li
                        key={o.id}
                        className={o.correcte ? "font-medium text-marque-800" : "text-slate-600"}
                      >
                        {o.correcte ? "✓" : "○"} {o.texte}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type === "code" && (
                  <p className="mt-3 text-sm text-slate-600">
                    Langage :{" "}
                    <strong>
                      {LANGAGES.find((l) => l.id === q.langage)?.nom ?? q.langage}
                    </strong>
                  </p>
                )}

                {detail.modifiable && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Bouton
                      variante="secondaire"
                      taille="s"
                      aria-label="Monter la question"
                      disabled={enCours || index === 0}
                      onClick={() => deplacer(index, -1)}
                    >
                      ↑
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      taille="s"
                      aria-label="Descendre la question"
                      disabled={enCours || index === liste.questions.length - 1}
                      onClick={() => deplacer(index, 1)}
                    >
                      ↓
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      taille="s"
                      disabled={enCours}
                      onClick={() => setEdition({ id: q.id, formulaire: versFormulaire(q) })}
                    >
                      Modifier
                    </Bouton>
                    <Bouton
                      variante="danger"
                      taille="s"
                      disabled={enCours}
                      onClick={() => supprimer(q)}
                    >
                      Supprimer
                    </Bouton>
                  </div>
                )}
              </Carte>
            ),
          )}

          {/* --- Le formulaire d'une NOUVELLE question, en bas de la liste --- */}
          {edition !== null && edition.id === null && (
            <EditeurQuestion
              titre="Nouvelle question"
              formulaire={edition.formulaire}
              onChange={(formulaire) => setEdition({ id: null, formulaire })}
              onEnregistrer={enregistrer}
              onAnnuler={() => setEdition(null)}
              enCours={enCours}
            />
          )}

          {/* --- Aperçu : ce que l'étudiant verra (les réponses ne sont pas enregistrées) --- */}
          {apercu && (
            <Carte className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Aperçu côté étudiant</h2>
              <Alerte type="info">
                Voici comment l’étudiant verra les questions. Ce que vous saisissez ici
                n’est pas enregistré.
              </Alerte>
              {liste.questions.map((q, index) => (
                <section key={q.id} className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm text-slate-500">
                    Question {index + 1} sur {liste.questions.length} ·{" "}
                    {pluriel(q.points, "point")}
                  </p>
                  <p className="mb-4 whitespace-pre-wrap text-lg">{q.enonce}</p>
                  <ChampReponse
                    question={q}
                    contenu={reponsesApercu[q.id]}
                    onChange={(contenu) =>
                      setReponsesApercu((avant) => ({ ...avant, [q.id]: contenu }))
                    }
                  />
                </section>
              ))}
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}

// La page : elle lit l'établissement actif et l'évaluation dans l'adresse. Le « key » donne
// un contenu tout neuf quand la personne change d'école ou d'évaluation.
export function PageQuestions() {
  const { etablissementActif } = useSession();
  const { id } = useParams<{ id: string }>();
  if (!etablissementActif || !id) return null;

  return (
    <ContenuQuestions
      key={`${etablissementActif.etablissementId}-${id}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
    />
  );
}