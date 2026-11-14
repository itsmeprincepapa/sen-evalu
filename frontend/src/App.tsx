import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { RouteProtegee } from './components/RouteProtegee';
import { PageAccueil } from './pages/PageAccueil';
import { PageConnexion } from './pages/PageConnexion';
import { PagePassage } from './pages/PagePassage';
import { PageEtablissements } from './pages/super-admin/PageEtablissements';
import { FournisseurSession } from './session/SessionContext';

// Le plan des adresses de l'application.
export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <BrowserRouter>
        <FournisseurSession>
          <Routes>
            {/* Les ÉTUDIANTS : le lien donné par l'enseignant (aucune connexion Google) */}
            <Route path="/e/:lien" element={<PagePassage />} />

            {/* La connexion des enseignants, administrateurs et super-administrateur */}
            <Route path="/connexion" element={<PageConnexion />} />

            {/* Réservé au super-administrateur */}
            <Route
              path="/super-admin"
              element={
                <RouteProtegee superAdmin>
                  <PageEtablissements />
                </RouteProtegee>
              }
            />

            {/* Accueil des autres personnes connectées */}
            <Route
              path="/"
              element={
                <RouteProtegee>
                  <PageAccueil />
                </RouteProtegee>
              }
            />

            {/* Toute autre adresse renvoie à l'accueil */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FournisseurSession>
      </BrowserRouter>
    </div>
  );
}