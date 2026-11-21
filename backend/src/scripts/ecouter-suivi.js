// Petit outil de TEST : se connecte au suivi en direct comme un enseignant et affiche
// tout ce que le serveur envoie. Utilisation (dans le dossier backend) :
//   node scripts/ecouter-suivi.js JETON_DU_PROF ID_ECOLE ID_EVALUATION
const { io } = require('socket.io-client');

const [jeton, etablissementId, evaluationId] = process.argv.slice(2);
if (!jeton || !etablissementId || !evaluationId) {
  console.log('Usage : node scripts/ecouter-suivi.js JETON ID_ECOLE ID_EVALUATION');
  process.exit(1);
}

const socket = io('http://localhost:3000/suivi', {
  auth: { jeton, etablissementId },
});

socket.on('connect', () => {
  console.log('Connecté au suivi en direct.');
  socket.emit('rejoindre', { evaluationId }, (reponse) => {
    if (!reponse.ok) {
      console.log('Refusé :', reponse.message);
      return;
    }
    console.log('Évaluation suivie :', reponse.evaluation.titre, '(' + reponse.evaluation.statut + ')');
    for (const e of reponse.etudiants) {
      console.log('  -', e.prenom, e.nom, '|', e.statut, '|', e.connexion, '| incidents', e.nbIncidentsGraves, '| question', e.questionEnCours);
    }
    console.log('--- En attente des changements ---');
  });
});

socket.on('etudiant:maj', (e) => {
  console.log('MAJ ÉTUDIANT :', e.prenom, '|', e.statut, '|', e.connexion, '| incidents', e.nbIncidentsGraves, '| question', e.questionEnCours);
});
socket.on('incident', (i) => {
  console.log('INCIDENT :', i.prenom, '|', i.type, '|', i.gravite, '|', i.details ?? '');
});
socket.on('evaluation:maj', (e) => {
  console.log('ÉVALUATION :', e.statut);
});
socket.on('connect_error', (e) => {
  console.log('Connexion refusée :', e.message);
  process.exit(1);
});