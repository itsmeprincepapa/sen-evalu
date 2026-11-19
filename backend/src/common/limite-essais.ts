import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// LIMITATION DES ESSAIS : empêche d'essayer des milliers de codes ou d'adresses.
// On compte les appels dans une « fenêtre » de temps ; au-delà du maximum, le serveur
// répond « trop d'essais » (statut 429) jusqu'à la fin de la fenêtre.

// QUI on compte :
// - 'ip'            : une adresse IP (une classe entière peut partager la même IP !) ;
// - 'ip-lien'       : une IP pour UNE évaluation (le lien) ;
// - 'ip-lien-email' : une IP pour UNE évaluation ET UNE adresse e-mail (un étudiant) ;
// - 'jeton'         : une session d'étudiant (son jeton).
export type CleLimite = 'ip' | 'ip-lien' | 'ip-lien-email' | 'jeton';

export interface OptionsLimite {
  max: number; // nombre d'appels autorisés dans la fenêtre
  secondes: number; // durée de la fenêtre
  par: CleLimite; // qui on compte
}

const NOM_METADONNEE = 'limite-essais';

// À poser sur une route : @LimiteEssais({ max: 5, secondes: 60, par: 'jeton' }).
// On peut donner plusieurs limites : elles sont toutes vérifiées.
export const LimiteEssais = (...limites: OptionsLimite[]) =>
  SetMetadata(NOM_METADONNEE, limites);

// Ce que la garde lit dans une requête (seulement ce dont elle a besoin).
interface RequeteHttp {
  ip?: string;
  method: string;
  route?: { path?: string };
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

// Un texte propre, ou vide si la valeur n'est pas un texte.
function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

@Injectable()
export class LimiteEssaisGuard implements CanActivate {
  // Les compteurs, gardés en mémoire : clé -> nombre d'appels et fin de la fenêtre.
  private readonly compteurs = new Map<
    string,
    { nombre: number; finFenetre: number }
  >();
  private dernierNettoyage = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Les limites posées sur la route (aucune : on laisse passer).
    const limites = this.reflector.get<OptionsLimite[] | undefined>(
      NOM_METADONNEE,
      context.getHandler(),
    );
    if (!limites || limites.length === 0) return true;

    const requete = context.switchToHttp().getRequest<RequeteHttp>();
    const route = `${requete.method} ${requete.route?.path ?? ''}`;
    const maintenant = Date.now();
    this.nettoyer(maintenant);

    limites.forEach((limite, numero) => {
      // La clé contient la route et le numéro de la limite : chaque limite a son compteur.
      const cle = `${route}|${numero}|${this.identifier(requete, limite.par)}`;
      const compteur = this.compteurs.get(cle);

      // Pas de compteur, ou fenêtre terminée : on repart à 1.
      if (!compteur || compteur.finFenetre <= maintenant) {
        this.compteurs.set(cle, {
          nombre: 1,
          finFenetre: maintenant + limite.secondes * 1000,
        });
        return;
      }

      compteur.nombre += 1;
      if (compteur.nombre > limite.max) {
        const attente = Math.ceil((compteur.finFenetre - maintenant) / 1000);
        throw new HttpException(
          {
            code: 'TROP_D_ESSAIS',
            message: `Trop d’essais. Réessayez dans ${attente} seconde${attente > 1 ? 's' : ''}.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });
    return true;
  }

  // Ce qui identifie « qui » on compte, selon le choix de la route.
  private identifier(requete: RequeteHttp, par: CleLimite): string {
    const ip = requete.ip ?? 'ip-inconnue';
    const lien = texte(requete.params?.lien) || texte(requete.body?.lien);
    const email = texte(requete.body?.email).toLowerCase();

    switch (par) {
      case 'jeton': {
        const jeton = requete.headers.authorization;
        return typeof jeton === 'string' && jeton !== '' ? jeton : ip;
      }
      case 'ip-lien':
        return `${ip}|${lien}`;
      case 'ip-lien-email':
        return `${ip}|${lien}|${email}`;
      default:
        return ip;
    }
  }

  // Supprime de temps en temps les compteurs dont la fenêtre est terminée
  // (sinon la mémoire grossirait sans fin).
  private nettoyer(maintenant: number): void {
    if (maintenant - this.dernierNettoyage < 60_000) return;
    this.dernierNettoyage = maintenant;
    for (const [cle, compteur] of this.compteurs) {
      if (compteur.finFenetre <= maintenant) this.compteurs.delete(cle);
    }
  }
}