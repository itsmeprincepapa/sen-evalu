import { useState, type FormEvent, type ReactNode } from "react";
import { useAntiTriche, type Avertissement } from "../hooks/useAntiTriche";
import { useSauvegardeAuto, type MotifFin } from "../hooks/useSauvegardeAuto";
import type { CopieLocale } from "../lib/copieLocale";
import type { Contenu, Entree } from "../types";
import { ChampReponse } from "./ChampReponse";

interface Props {
  entree: Entree;
  cleCopie: string;
  copieInitiale: CopieLocale;
  onFin: (motif: MotifFin) => void;
}

// Transforme 754 secondes en « 12:34 ».
function formaterTemps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, "0")}:${String(reste).padStart(2, "0")}`;
}

// Une question est « répondue » si elle contient quelque chose.
function estRepondue(contenu: Contenu | undefined): boolean {
  if (contenu === undefined) return false;
  return Array.isArray(contenu) ? contenu.length > 0 : contenu.trim() !== "";
}

// Le texte de l'avertissement après un incident grave.
function texteAvertissement(a: Avertissement): string {
  const cause =
    a.type === "sortie_plein_ecran"
      ? "Vous avez quitté le plein écran."
      : "Vous avez changé d’onglet ou de fenêtre.";
  const reste = a.seuil - a.nbIncidentsGraves;
  const suite =
    reste <= 1
      ? "Au prochain incident, vous serez exclu de l’évaluation."
      : `Encore ${reste} incidents graves et vous serez exclu de l’évaluation.`;
  return `${cause} ${suite} Cet incident est enregistré dans le journal de votre enseignant.`;
}

// Un écran qui COUVRE toute la page (plein écran à rétablir, avertissement).
function EcranBloquant({ children }: { children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center"
    >
      <div className="max-w-md space-y-4">{children}</div>
    </div>
  );
}

// L'écran de l'évaluation : en-tête (nom, minuteur, état), question, navigation.
export function Epreuve({ entree, cleCopie, copieInitiale, onFin }: Props) {
    const [index, setIndex] = useState(0); // numéro de la question affichée

  // Tout le travail invisible (sauvegarde, minuteur, copie locale) est dans ce hook.
  const {
    brouillons,
    modifier,
    secondes,
    reseau,
    nbNonEnvoyees,
    terminerMaintenant,
    synchroniser,
    finir,
  } = useSauvegardeAuto({
    jeton: entree.jeton,
    cleCopie,
    reponsesInitiales: entree.reponses,
    copieInitiale,
        secondesInitiales: entree.tempsRestantSecondes,
    questionAffichee: index + 1,
    onFin,
  });

  const { questions, evaluation, etudiant } = entree;

  // L'anti-triche : plein écran, changements d'onglet, avertissement.
  const {
    enPleinEcran,
    avertissement,
    refusPleinEcran,
    demanderPleinEcran,
    fermerAvertissement,
  } = useAntiTriche({
    jeton: entree.jeton,
    pleinEcranObligatoire: evaluation.pleinEcranObligatoire,
    detecterChangementOnglet: evaluation.detecterChangementOnglet,
    synchroniser,
    finir,
  });

    const [message, setMessage] = useState<string | null>(null);
  const [terminaison, setTerminaison] = useState(false);
  const [saisieSortie, setSaisieSortie] = useState(false); // l'encadré du code de sortie est ouvert
  const [codeSortie, setCodeSortie] = useState("");

  const question = questions[index];

  // Le plein écran est exigé et l'étudiant n'y est pas : l'évaluation est cachée.
  const besoinPleinEcran = evaluation.pleinEcranObligatoire && !enPleinEcran;

  // Peut-on aller à la question « cible » ? Cela dépend des options de l'enseignant.
  function peutAller(cible: number): boolean {
    if (cible === index) return true;
    if (evaluation.navigationLibre) return true; // navigation libre
    if (cible === index + 1) return true; // on peut toujours avancer
    return evaluation.retourEnArriere && cible === index - 1;
  }

  // Validation de l'encadré : on envoie le code de sortie. Si le code est faux, le serveur
  // refuse et l'étudiant reste dans l'évaluation, avec ses réponses.
  async function terminer(ev: FormEvent) {
    ev.preventDefault();
    setMessage(null);
    setTerminaison(true);
    try {
      await terminerMaintenant(codeSortie); // en cas de succès, la page passe à l'écran de fin
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Impossible de terminer pour le moment.",
      );
      setTerminaison(false);
    }
  }

  // Indicateur d'état de la sauvegarde (en haut de l'écran).
  let etat: { texte: string; classes: string };
  if (reseau === "hors-ligne") {
    etat = {
      texte: "Hors ligne : vos réponses sont gardées sur cet ordinateur",
      classes: "bg-orange-100 text-orange-800",
    };
  } else if (nbNonEnvoyees > 0) {
    etat = { texte: "Envoi en cours…", classes: "bg-slate-100 text-slate-700" };
  } else {
    etat = {
      texte: "Tout est enregistré",
      classes: "bg-green-100 text-green-800",
    };
  }

  if (!question) {
    return <p className="p-6">Cette évaluation ne contient aucune question.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* --- Écrans qui couvrent l'évaluation --- */}
      {besoinPleinEcran && (
        <EcranBloquant>
          <h2 className="text-2xl font-bold">
            {avertissement ? "Avertissement" : "Cette évaluation se passe en plein écran"}
          </h2>
          {avertissement ? (
            <p className="text-slate-700">{texteAvertissement(avertissement)}</p>
          ) : (
            <p className="text-slate-700">
              Cliquez sur le bouton pour passer en plein écran et afficher les questions.
            </p>
          )}
          <p className="text-sm text-slate-600">
            Le temps continue de s’écouler : il reste{" "}
            <strong className="font-mono">{formaterTemps(secondes)}</strong>.
          </p>
          {refusPleinEcran && (
            <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
              Votre navigateur n’a pas accepté le plein écran. Réessayez, ou utilisez
              un navigateur récent (Chrome, Edge ou Firefox).
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              fermerAvertissement();
              demanderPleinEcran();
            }}
            className="rounded bg-marque-600 px-6 py-3 text-white hover:bg-marque-700"
          >
            {avertissement ? "Revenir en plein écran" : "Passer en plein écran"}
          </button>
        </EcranBloquant>
      )}

      {!besoinPleinEcran && avertissement && (
        <EcranBloquant>
          <h2 className="text-2xl font-bold">Avertissement</h2>
          <p className="text-slate-700">{texteAvertissement(avertissement)}</p>
          <button
            type="button"
            onClick={fermerAvertissement}
            className="rounded bg-marque-600 px-6 py-3 text-white hover:bg-marque-700"
          >
            J’ai compris
          </button>
        </EcranBloquant>
      )}

      {/* En-tête : titre, nom de l'étudiant, minuteur */}
      <header className="mb-4 flex items-center justify-between rounded-lg bg-white p-4 shadow">
        <div>
          <h1 className="text-lg font-bold">{evaluation.titre}</h1>
          <p className="text-sm text-slate-600">
            {etudiant.prenom} {etudiant.nom}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`font-mono text-2xl ${secondes <= 60 ? "text-red-600" : ""}`}
          >
            {formaterTemps(secondes)}
          </div>
          <span className={`rounded px-2 py-1 text-xs ${etat.classes}`}>
            {etat.texte}
          </span>
        </div>
      </header>

      {/* Boutons numérotés : bleu = question affichée, vert = répondue */}
      <nav className="mb-4 flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            disabled={!peutAller(i)}
            onClick={() => setIndex(i)}
            className={`h-10 w-10 rounded border font-medium disabled:opacity-40 ${
              i === index
                ? "border-marque-600 bg-marque-600 text-white"
                : estRepondue(brouillons[q.id]?.contenu)
                  ? "border-green-600 bg-green-50 text-green-800"
                  : "border-slate-300 bg-white"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {/* La question affichée */}
      <section className="rounded-lg bg-white p-6 shadow">
        <p className="mb-1 text-sm text-slate-500">
          Question {index + 1} sur {questions.length} ({question.points}{" "}
          {question.points > 1 ? "points" : "point"})
        </p>
        <p className="mb-4 whitespace-pre-wrap text-lg">{question.enonce}</p>

        <ChampReponse
          key={question.id}
          question={question}
          contenu={brouillons[question.id]?.contenu}
          onChange={(contenu) => modifier(question.id, contenu)}
        />
      </section>

      {/* Pour terminer : le code de sortie donné par l'enseignant */}
      {saisieSortie && (
        <section className="mt-4 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-1 text-lg font-semibold">Terminer l’évaluation</h2>
          <p className="mb-3 text-sm text-slate-600">
            Vous ne pourrez plus modifier vos réponses. Demandez le code de sortie à
            votre enseignant, puis saisissez-le.
          </p>
          <form
            onSubmit={(ev) => void terminer(ev)}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              type="text"
              value={codeSortie}
              onChange={(e) => setCodeSortie(e.target.value)}
              aria-label="Code de sortie"
              placeholder="Code de sortie"
              autoComplete="off"
              maxLength={20}
              className="rounded border border-slate-300 p-2"
            />
            <button
              type="submit"
              disabled={terminaison || codeSortie.trim() === ""}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {terminaison ? "Envoi…" : "Valider et terminer"}
            </button>
            <button
              type="button"
              disabled={terminaison}
              onClick={() => {
                setSaisieSortie(false);
                setCodeSortie("");
                setMessage(null);
              }}
              className="rounded border border-slate-300 bg-white px-4 py-2 disabled:opacity-50"
            >
              Annuler
            </button>
          </form>
        </section>
      )}

      {message && (
        <p
          role="alert"
          className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700"
        >
          {message}
        </p>
      )}

      {/* Navigation et fin */}
      <footer className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0 || !peutAller(index - 1)}
          onClick={() => setIndex(index - 1)}
          className="rounded border border-slate-300 bg-white px-4 py-2 disabled:opacity-40"
        >
          Précédent
        </button>

        {index < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            className="rounded bg-marque-600 px-4 py-2 text-white hover:bg-marque-700"
          >
            Suivant
          </button>
        ) : (
          <button
            type="button"
            disabled={saisieSortie}
            onClick={() => setSaisieSortie(true)}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Terminer l’évaluation
          </button>
        )}
      </footer>
    </div>
  );
}