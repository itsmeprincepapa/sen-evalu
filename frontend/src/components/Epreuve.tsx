import { useState } from 'react';
import { useSauvegardeAuto, type MotifFin } from '../hooks/useSauvegardeAuto';
import type { CopieLocale } from '../lib/copieLocale';
import type { Contenu, Entree } from '../types';
import { ChampReponse } from './ChampReponse';

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
  return `${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}

// Une question est « répondue » si elle contient quelque chose.
function estRepondue(contenu: Contenu | undefined): boolean {
  if (contenu === undefined) return false;
  return Array.isArray(contenu) ? contenu.length > 0 : contenu.trim() !== '';
}

// L'écran de l'évaluation : en-tête (nom, minuteur, état), question, navigation.
export function Epreuve({ entree, cleCopie, copieInitiale, onFin }: Props) {
  // Tout le travail invisible (sauvegarde, minuteur, copie locale) est dans ce hook.
  const {
    brouillons,
    modifier,
    secondes,
    reseau,
    nbNonEnvoyees,
    terminerMaintenant,
  } = useSauvegardeAuto({
    jeton: entree.jeton,
    cleCopie,
    reponsesInitiales: entree.reponses,
    copieInitiale,
    secondesInitiales: entree.tempsRestantSecondes,
    onFin,
  });

  const [index, setIndex] = useState(0); // numéro de la question affichée
  const [message, setMessage] = useState<string | null>(null);
  const [terminaison, setTerminaison] = useState(false);

  const { questions, evaluation, etudiant } = entree;
  const question = questions[index];

  // Peut-on aller à la question « cible » ? Cela dépend des options de l'enseignant.
  function peutAller(cible: number): boolean {
    if (cible === index) return true;
    if (evaluation.navigationLibre) return true; // navigation libre
    if (cible === index + 1) return true; // on peut toujours avancer
    return evaluation.retourEnArriere && cible === index - 1;
  }

  // Clic sur « Terminer l'évaluation ».
  async function terminer() {
    if (
      !window.confirm(
        'Voulez-vous vraiment terminer ? Vous ne pourrez plus modifier vos réponses.',
      )
    ) {
      return;
    }
    setMessage(null);
    setTerminaison(true);
    try {
      await terminerMaintenant(); // en cas de succès, la page passe à l'écran de fin
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Impossible de terminer pour le moment.',
      );
      setTerminaison(false);
    }
  }

  // Indicateur d'état de la sauvegarde (en haut de l'écran).
  let etat: { texte: string; classes: string };
  if (reseau === 'hors-ligne') {
    etat = {
      texte: 'Hors ligne : vos réponses sont gardées sur cet ordinateur',
      classes: 'bg-orange-100 text-orange-800',
    };
  } else if (nbNonEnvoyees > 0) {
    etat = { texte: 'Envoi en cours…', classes: 'bg-slate-100 text-slate-700' };
  } else {
    etat = {
      texte: 'Tout est enregistré',
      classes: 'bg-green-100 text-green-800',
    };
  }

  if (!question) {
    return <p className="p-6">Cette évaluation ne contient aucune question.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
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
            className={`font-mono text-2xl ${secondes <= 60 ? 'text-red-600' : ''}`}
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
                ? 'border-blue-600 bg-blue-600 text-white'
                : estRepondue(brouillons[q.id]?.contenu)
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-slate-300 bg-white'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {/* La question affichée */}
      <section className="rounded-lg bg-white p-6 shadow">
        <p className="mb-1 text-sm text-slate-500">
          Question {index + 1} sur {questions.length} ({question.points}{' '}
          {question.points > 1 ? 'points' : 'point'})
        </p>
        <p className="mb-4 whitespace-pre-wrap text-lg">{question.enonce}</p>

        <ChampReponse
          key={question.id}
          question={question}
          contenu={brouillons[question.id]?.contenu}
          onChange={(contenu) => modifier(question.id, contenu)}
        />
      </section>

      {message && (
        <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
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
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Suivant
          </button>
        ) : (
          <button
            type="button"
            disabled={terminaison}
            onClick={() => void terminer()}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {terminaison ? 'Envoi…' : 'Terminer l’évaluation'}
          </button>
        )}
      </footer>
    </div>
  );
}