// Les langages proposés pour une question de code.
// Les identifiants doivent être EXACTEMENT ceux du serveur (backend/src/evaluations/langages.ts)
// et de Monaco. Pour en ajouter un, l'écrire aux deux endroits.
export const LANGAGES: { id: string; nom: string }[] = [
  { id: 'javascript', nom: 'JavaScript' },
  { id: 'typescript', nom: 'TypeScript' },
  { id: 'python', nom: 'Python' },
  { id: 'java', nom: 'Java' },
  { id: 'c', nom: 'C' },
  { id: 'cpp', nom: 'C++' },
  { id: 'csharp', nom: 'C#' },
  { id: 'php', nom: 'PHP' },
  { id: 'sql', nom: 'SQL' },
  { id: 'html', nom: 'HTML' },
  { id: 'css', nom: 'CSS' },
  { id: 'algo', nom: 'Algorithme (pseudo-code)' },
];