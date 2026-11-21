import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { RouteProtegee } from './components/RouteProtegee';
import { PageAccueil } from './pages/PageAccueil';
import { PageConnexion } from './pages/PageConnexion';
import { PagePassage } from './pages/PagePassage';
import { PageEtablissements } from './pages/super-admin/PageEtablissements';
import { FournisseurSession } from './session/SessionContext';
import { PageEnseignants } from './pages/ecole/PageEnseignants';
import { PageClasse } from './pages/ecole/PageClasse';
import { PageClasses } from './pages/ecole/PageClasses';
import { PageEvaluations } from './pages/ecole/PageEvaluations';
import { PageFormulaireEvaluation } from './pages/ecole/PageFormulaireEvaluation';
import { PageInscriptions } from './pages/ecole/PageInscriptions';
import { PageDesign } from './pages/PageDesign';
import { PageQuestions } from './pages/ecole/PageQuestions';
import { PageSuivi } from './pages/ecole/PageSuivi';
import { PageCopie } from './pages/ecole/PageCopie';
import { PageResultats } from './pages/ecole/PageResultats';

// Le plan des adresses de l'application.
export default function App() {
  return (
    <div className="min-h-screen">
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
            {/* Réservé aux administrateurs d'école (dans leur établissement actif) */}
            <Route
              path="/ecole/enseignants"
              element={
                <RouteProtegee role="admin">
                  <PageEnseignants />
                </RouteProtegee>
              }
            />

            {/* Les classes : ouvertes aux administrateurs ET aux enseignants */}
            <Route
              path="/ecole/classes"
              element={
                <RouteProtegee role={['admin', 'enseignant']}>
                  <PageClasses />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/classes/:id"
              element={
                <RouteProtegee role={['admin', 'enseignant']}>
                  <PageClasse />
                </RouteProtegee>
              }
            />

            {/* Les évaluations de l'enseignant, leur création et la validation des inscriptions */}
            <Route
              path="/ecole/evaluations"
              element={
                <RouteProtegee role="enseignant">
                  <PageEvaluations />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/evaluations/nouvelle"
              element={
                <RouteProtegee role="enseignant">
                  <PageFormulaireEvaluation />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/evaluations/:id/modifier"
              element={
                <RouteProtegee role="enseignant">
                  <PageFormulaireEvaluation />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/evaluations/:id/questions"
              element={
                <RouteProtegee role="enseignant">
                  <PageQuestions />
                </RouteProtegee>
              }
            />
                        <Route
              path="/ecole/evaluations/:id/suivi"
              element={
                <RouteProtegee role="enseignant">
                  <PageSuivi />
                </RouteProtegee>
              }
            />
                        <Route
              path="/ecole/evaluations/:id/correction"
              element={
                <RouteProtegee role="enseignant">
                  <PageResultats />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/evaluations/:id/correction/:participationId"
              element={
                <RouteProtegee role="enseignant">
                  <PageCopie />
                </RouteProtegee>
              }
            />
            <Route
              path="/ecole/evaluations/:id/inscriptions"
              element={
                <RouteProtegee role="enseignant">
                  <PageInscriptions />
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
            {/* Galerie de style : seulement pendant le développement */}
            {import.meta.env.DEV && <Route path="/design" element={<PageDesign />} />}

            {/* Toute autre adresse renvoie à l'accueil */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FournisseurSession>
      </BrowserRouter>
    </div>
  );
}