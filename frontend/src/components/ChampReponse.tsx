import type { Contenu, Question } from '../types';

interface Props {
  question: Question;
  contenu: Contenu | undefined; // la réponse actuelle (vide si pas encore répondu)
  onChange: (contenu: Contenu) => void; // appelée à chaque modification
}

// Affiche le bon champ selon le type de la question.
export function ChampReponse({ question, contenu, onChange }: Props) {
  // --- QCM : cases à cocher (plusieurs réponses) ou boutons radio (une seule) ---
  if (question.type === 'qcm_unique' || question.type === 'qcm_multiple') {
    const cochees = Array.isArray(contenu) ? contenu : [];
    const unique = question.type === 'qcm_unique';

    // Clic sur une proposition.
    const basculer = (idOption: string) => {
      if (unique) {
        onChange([idOption]); // une seule réponse : elle remplace la précédente
      } else if (cochees.includes(idOption)) {
        onChange(cochees.filter((id) => id !== idOption)); // on décoche
      } else {
        onChange([...cochees, idOption]); // on coche
      }
    };

    return (
      <div className="space-y-2">
        {question.options?.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded border border-slate-300 p-3 hover:bg-slate-50"
          >
            <input
              type={unique ? 'radio' : 'checkbox'}
              name={question.id}
              checked={cochees.includes(option.id)}
              onChange={() => basculer(option.id)}
              className="h-4 w-4"
            />
            <span>{option.texte}</span>
          </label>
        ))}
        <p className="text-sm text-slate-500">
          {unique
            ? 'Une seule réponse possible.'
            : 'Plusieurs réponses possibles : cochez toutes les bonnes.'}
        </p>
      </div>
    );
  }

  // --- Les autres types attendent un texte ---
  const texte = typeof contenu === 'string' ? contenu : '';

  // Réponse courte : une seule ligne.
  if (question.type === 'reponse_courte') {
    return (
      <input
        type="text"
        value={texte}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 p-2"
      />
    );
  }

  // Question ouverte (rédaction) ou question de code : une grande zone de texte.
  // (L'éditeur de code complet, Monaco, sera ajouté à l'étape 6.)
  const estCode = question.type === 'code';
  return (
    <div>
      {estCode && (
        <p className="mb-2 text-sm text-slate-600">
          Langage : <strong>{question.langage}</strong>. Votre programme ne sera
          pas exécuté : écrivez-le soigneusement.
        </p>
      )}
      <textarea
        value={texte}
        onChange={(e) => onChange(e.target.value)}
        rows={estCode ? 12 : 8}
        spellCheck={!estCode}
        autoComplete="off"
        className={`w-full rounded border border-slate-300 p-3 ${
          estCode ? 'font-mono text-sm' : ''
        }`}
      />
    </div>
  );
}