
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import cssWorker from '../../node_modules/monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from '../../node_modules/monaco-editor/esm/vs/language/html/html.worker?worker';
import editorWorker from '../../node_modules/monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from '../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configuration des workers Monaco
self.MonacoEnvironment = {
  getWorker(_idTache: string, langage: string) {
    if (langage === 'typescript' || langage === 'javascript') {
      return new tsWorker();
    }

    if (langage === 'css') {
      return new cssWorker();
    }

    if (langage === 'html') {
      return new htmlWorker();
    }

    return new editorWorker();
  },
};

// Utiliser la version locale de Monaco
loader.config({ monaco });

interface Props {
  valeur: string;
  langage: string;
  onChange: (valeur: string) => void;
}

export default function EditeurCode({
  valeur,
  langage,
  onChange,
}: Props) {
  return (
    <div className="overflow-hidden rounded border border-slate-300">
      <Editor
        height="360px"
        language={langage}
        value={valeur}
        onChange={(nouvelleValeur) => onChange(nouvelleValeur ?? '')}
        loading={
          <p className="p-3 text-sm text-slate-500">
            Chargement de l'éditeur...
          </p>
        }
        options={{
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
