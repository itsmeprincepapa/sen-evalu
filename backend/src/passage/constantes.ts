// Constantes partagées par les fichiers du module « passage ».

// Marge accordée après l'heure de fin : une sauvegarde partie juste avant la fin
// peut arriver quelques secondes plus tard à cause du réseau.
export const MARGE_FIN_SECONDES = 5;

// Fréquence de la tâche automatique qui vérifie les temps écoulés (en millisecondes).
export const INTERVALLE_CLOTURE_MS = 30_000;