
import Editor from '@monaco-editor/react';

interface Props {
  valeur: string;
  langage: string;
  onChange?: (valeur: string) => void;
  lectureSeule?: boolean;
  hauteur?: string;
}

export default function EditeurCode({
  valeur,
  langage,
  onChange,
  lectureSeule = false,
  hauteur = '360px',
}: Props) {
  return (
    <div className="overflow-hidden rounded border border-slate-300">
      <Editor
        height={hauteur}
        language={langage}
        value={valeur}
        onChange={(nouvelleValeur) => onChange?.(nouvelleValeur ?? '')}
        loading={
          <p className="p-3 text-sm text-slate-500">
            Chargement de l'éditeur…
          </p>
        }
        options={{
          readOnly: lectureSeule,
          fontSize: 14,
          tabSize: 4,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: false },
        }}
      />
    </div>
  );
}
