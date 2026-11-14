import type { Profil, ReponseConnexion } from '../types';
import { appeler } from './http';

// Se connecter : on envoie au serveur le jeton remis par Google ;
// il le fait vérifier et répond avec NOTRE session et le profil.
export const connexionGoogle = (credential: string) =>
  appeler<ReponseConnexion>('/auth/google', {
    methode: 'POST',
    corps: { credential },
  });

// Qui suis-je ? (sert à vérifier une session existante après un rechargement)
export const moi = (jeton: string) =>
  appeler<Profil>('/auth/moi', { methode: 'GET', jeton });