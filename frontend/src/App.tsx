import { PagePassage } from './pages/PagePassage';

// Une seule page pour l'instant. Plus tard : un routeur (React Router)
// pour les autres écrans (enseignant, administrateur...).
export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <PagePassage />
    </div>
  );
}