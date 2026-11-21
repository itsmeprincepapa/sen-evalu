import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  accorderTemps,
  autoriserReconnexion,
  reintegrer,
  terminerPourTous,
} from "../../api/suivi";
import { EnteteSession } from "../../components/EnteteSession";
import { useErreurs } from "../../hooks/useErreurs";
import { useSuiviEnDirect } from "../../hooks/useSuiviEnDirect";
import {
  LIBELLES_INCIDENT,
  LIBELLES_STATUT_EVALUATION,
} from "../../lib/libelles";
import { useSession } from "../../session/SessionContext";
import type { EtatConnexion } from "../../types";
import { Alerte } from "../../ui/Alerte";
import { Badge, type TonBadge } from "../../ui/Badge";
import { Bouton } from "../../ui/Bouton";
import { Carte } from "../../ui/Carte";

// Le texte et la couleur de l'état de connexion de chaque étudiant.
const ETATS: Record<EtatConnexion, { texte: string; ton: TonBadge }> = {
  pas_entre: { texte: "Pas encore entré", ton: "neutre" },
  connecte: { texte: "Connecté", ton: "succes" },
  coupe: { texte: "Connexion coupée", ton: "attention" },
  exclu: { texte: "Exclu", ton: "danger" },
  termine: { texte: "Terminé", ton: "info" },
};

// Transforme 754 secondes en « 12:34 ».
function formaterTemps(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, "0")}:${String(reste).padStart(2, "0")}`;
}

interface Props {
  idEtablissement: string;
  idEvaluation: string;
}

// Le contenu de la page, pour UNE évaluation d'UN établissement.
function ContenuSuivi({ idEtablissement, idEvaluation }: Props) {
  const { jeton } = useSession();
  const jetonSession = jeton ?? "";
  const { erreur, setErreur, traiter } = useErreurs();

  const { evaluation, etudiants, journal, alertes, liaison, fermerAlerte, rafraichir } =
    useSuiviEnDirect({
      jeton: jetonSession,
      etablissementId: idEtablissement,
      evaluationId: idEvaluation,
      onErreur: traiter,
    });

  const [selection, setSelection] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // L'heure actuelle, mise à jour chaque seconde : sert à faire diminuer le temps restant
  // des étudiants entre deux messages du serveur.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ligne = etudiants.find((e) => e.participationId === selection) ?? null;
  const nbConnectes = etudiants.filter((e) => e.connexion === "connecte").length;

  // Exécute une action : efface les anciens messages, bloque les boutons pendant l'envoi,
  // affiche l'erreur éventuelle, puis recale l'écran sur le serveur.
  async function executer(travail: () => Promise<string>) {
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      setInfo(await travail());
      rafraichir();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function donnerTemps(minutes: number) {
    if (!ligne) return;
    void executer(async () => {
      const r = await accorderTemps(
        jetonSession,
        idEtablissement,
        idEvaluation,
        ligne.participationId,
        minutes,
      );
      return r.limiteParLaPlage
        ? `+${minutes} min pour ${ligne.prenom}, mais le temps est plafonné par la fin de la plage horaire.`
        : `+${minutes} min accordées à ${ligne.prenom}.`;
    });
  }

  function reconnexion() {
    if (!ligne) return;
    void executer(async () => {
      await autoriserReconnexion(
        jetonSession,
        idEtablissement,
        idEvaluation,
        ligne.participationId,
      );
      return `Reconnexion autorisée pour ${ligne.prenom} : elle peut ressaisir le code d’accès.`;
    });
  }

  function reintegrerEtudiant(minutes?: number) {
    if (!ligne) return;
    void executer(async () => {
      await reintegrer(
        jetonSession,
        idEtablissement,
        idEvaluation,
        ligne.participationId,
        minutes,
      );
      return `${ligne.prenom} est réintégré : elle doit ressaisir le code d’accès pour reprendre.`;
    });
  }

  function terminerTous() {
    if (
      !window.confirm(
        "Terminer l’évaluation pour tous les étudiants ? Les réponses déjà envoyées sont conservées, mais personne ne pourra plus répondre.",
      )
    ) {
      return;
    }
    void executer(async () => {
      const r = await terminerPourTous(jetonSession, idEtablissement, idEvaluation);
      return `Évaluation terminée : ${r.terminees} étudiant${r.terminees > 1 ? "s" : ""} terminé${r.terminees > 1 ? "s" : ""}.`;
    });
  }

  // Le temps restant d'un étudiant, décompté depuis la réception de sa ligne.
  function tempsRestant(e: (typeof etudiants)[number]): string {
    if (e.tempsRestantSecondes === null) return "–";
    const ecoule = Math.floor((maintenant - e.recuLe) / 1000);
    return formaterTemps(Math.max(0, e.tempsRestantSecondes - ecoule));
  }

  const liaisonBadge =
    liaison === "en-direct" ? (
      <Badge ton="succes">En direct</Badge>
    ) : liaison === "connexion" ? (
      <Badge ton="neutre">Connexion…</Badge>
    ) : (
      <Badge ton="attention">Liaison interrompue, reconnexion…</Badge>
    );

  return (
    <div className="mx-auto max-w-5xl p-4">
      <EnteteSession titre="Suivi en direct" />

      <Link
        to="/ecole/evaluations"
        className="mb-4 inline-block text-sm text-marque-700 hover:underline"
      >
        ← Retour à mes évaluations
      </Link>

      {/* Alertes en temps réel : un bandeau par incident grave */}
      <div className="fixed right-4 top-4 z-50 w-80 space-y-2">
        {alertes.map((a) => (
          <Alerte key={a.id} type="erreur">
            <div className="flex items-start justify-between gap-2">
              <span>
                <strong>
                  {a.prenom} {a.nom}
                </strong>{" "}
                : {LIBELLES_INCIDENT[a.type] ?? a.type}
              </span>
              <button
                type="button"
                onClick={() => fermerAlerte(a.id)}
                className="shrink-0 text-xs underline"
              >
                Fermer
              </button>
            </div>
          </Alerte>
        ))}
      </div>

      {erreur && <Alerte type="erreur" className="mb-4">{erreur}</Alerte>}
      {info && <Alerte type="succes" className="mb-4">{info}</Alerte>}

      {evaluation === null ? (
        <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          {/* --- En-tête : titre, état, compteur, bouton de fin --- */}
          <Carte>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {evaluation.titre}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {evaluation.statut === "planifiee" || evaluation.statut === "en_cours" ? (
                    <>
                      <strong>
                        {nbConnectes} connecté{nbConnectes > 1 ? "s" : ""} sur{" "}
                        {etudiants.length}
                      </strong>
                      {" · "}
                    </>
                  ) : null}
                  État :{" "}
                  {LIBELLES_STATUT_EVALUATION[evaluation.statut] ?? evaluation.statut}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {liaisonBadge}
                {evaluation.statut === "en_cours" && (
                  <Bouton variante="danger" disabled={enCours} onClick={terminerTous}>
                    Terminer l’évaluation pour tous
                  </Bouton>
                )}
              </div>
            </div>
          </Carte>

          {etudiants.length === 0 ? (
            <Alerte type="info">
              Aucun étudiant validé pour le moment. Validez les inscriptions pour les
              voir apparaître ici.
            </Alerte>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {/* --- Les étudiants --- */}
              <Carte className="overflow-x-auto lg:col-span-2">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2 pr-3 font-medium">Étudiant</th>
                      <th className="py-2 pr-3 font-medium">État</th>
                      <th className="py-2 pr-3 font-medium">Question</th>
                      <th className="py-2 pr-3 font-medium">Incidents</th>
                      <th className="py-2 font-medium">Temps restant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etudiants.map((e) => {
                      const etat = ETATS[e.connexion];
                      return (
                        <tr
                          key={e.participationId}
                          onClick={() => setSelection(e.participationId)}
                          className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                            e.participationId === selection ? "bg-sky-50" : ""
                          }`}
                        >
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelection(e.participationId)}
                              className="text-left font-medium text-slate-900"
                            >
                              {e.prenom} {e.nom}
                            </button>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge ton={etat.ton}>{etat.texte}</Badge>
                          </td>
                          <td className="py-2 pr-3">
                            {e.questionEnCours !== null
                              ? `${e.questionEnCours} / ${evaluation.nombreQuestions}`
                              : "–"}
                          </td>
                          <td className="py-2 pr-3">
                            {e.nbIncidentsGraves > 0 ? (
                              <Badge ton="danger">{e.nbIncidentsGraves}</Badge>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-2 font-mono">{tempsRestant(e)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Carte>

              {/* --- Les actions sur l'étudiant sélectionné --- */}
              <Carte className="space-y-3">
                <h3 className="font-semibold text-slate-900">Actions</h3>
                {ligne === null ? (
                  <p className="text-sm text-slate-600">
                    Cliquez sur un étudiant pour agir sur lui.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-700">
                      <strong>
                        {ligne.prenom} {ligne.nom}
                      </strong>
                      <br />
                      <span className="text-slate-500">{ligne.email}</span>
                    </p>
                    {ligne.tempsSupplementaireSecondes > 0 && (
                      <p className="text-xs text-slate-500">
                        Temps supplémentaire déjà accordé :{" "}
                        {Math.round(ligne.tempsSupplementaireSecondes / 60)} min.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Bouton
                        variante="secondaire"
                        taille="s"
                        disabled={
                          enCours ||
                          !["valide", "en_cours", "exclu"].includes(ligne.statut) ||
                          !["planifiee", "en_cours"].includes(evaluation.statut)
                        }
                        onClick={() => donnerTemps(5)}
                      >
                        +5 min
                      </Bouton>
                      <Bouton
                        variante="secondaire"
                        taille="s"
                        disabled={
                          enCours ||
                          !["valide", "en_cours", "exclu"].includes(ligne.statut) ||
                          !["planifiee", "en_cours"].includes(evaluation.statut)
                        }
                        onClick={() => donnerTemps(10)}
                      >
                        +10 min
                      </Bouton>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Bouton
                        variante="secondaire"
                        taille="s"
                        disabled={enCours || ligne.statut !== "en_cours"}
                        onClick={reconnexion}
                      >
                        Autoriser reconnexion
                      </Bouton>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Bouton
                        variante="secondaire"
                        taille="s"
                        disabled={
                          enCours ||
                          ligne.statut !== "exclu" ||
                          evaluation.statut !== "en_cours"
                        }
                        onClick={() => reintegrerEtudiant()}
                      >
                        Réintégrer
                      </Bouton>
                      <Bouton
                        variante="secondaire"
                        taille="s"
                        disabled={
                          enCours ||
                          ligne.statut !== "exclu" ||
                          evaluation.statut !== "en_cours"
                        }
                        onClick={() => reintegrerEtudiant(5)}
                      >
                        Réintégrer (+5 min)
                      </Bouton>
                    </div>
                    <p className="text-xs text-slate-500">
                      Après une reconnexion ou une réintégration, l’étudiant doit
                      ressaisir le code d’accès ; ses réponses sont retrouvées.
                    </p>
                  </>
                )}
              </Carte>
            </div>
          )}

          {/* --- Le journal des incidents --- */}
          <Carte>
            <h3 className="mb-2 font-semibold text-slate-900">Journal</h3>
            {journal.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun incident pour le moment.</p>
            ) : (
              <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
                {journal.map((i) => (
                  <li
                    key={i.id}
                    className={i.gravite === "grave" ? "text-red-700" : "text-slate-600"}
                  >
                    <span className="font-mono text-xs text-slate-500">
                      {new Date(i.heure).toLocaleTimeString("fr-FR")}
                    </span>{" "}
                    <strong>
                      {i.prenom} {i.nom}
                    </strong>{" "}
                    : {LIBELLES_INCIDENT[i.type] ?? i.type}
                    {i.details ? ` (${i.details})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      )}
    </div>
  );
}

// La page : elle lit l'établissement actif et l'évaluation dans l'adresse. Le « key » donne
// un contenu tout neuf quand la personne change d'école ou d'évaluation.
export function PageSuivi() {
  const { etablissementActif } = useSession();
  const { id } = useParams<{ id: string }>();
  if (!etablissementActif || !id) return null;

  return (
    <ContenuSuivi
      key={`${etablissementActif.etablissementId}-${id}`}
      idEtablissement={etablissementActif.etablissementId}
      idEvaluation={id}
    />
  );
}