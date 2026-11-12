import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { Repository } from 'typeorm';
import { Membre } from '../database/entities/membre.entity';
import { Utilisateur } from '../database/entities/utilisateur.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Outil officiel de Google pour vérifier un jeton d'identité.
  private readonly clientGoogle: OAuth2Client;
  private readonly idClientGoogle: string;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(Utilisateur)
    private readonly utilisateurs: Repository<Utilisateur>,
    @InjectRepository(Membre)
    private readonly membres: Repository<Membre>,
  ) {
    // Le serveur refuse de démarrer si GOOGLE_CLIENT_ID manque dans le fichier .env.
    this.idClientGoogle = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientGoogle = new OAuth2Client(this.idClientGoogle);
  }

  // ---------------------------------------------------------------------------
  // CONNEXION : le navigateur envoie le jeton remis par Google.
  // ---------------------------------------------------------------------------
  async connecterAvecGoogle(credential: string) {
    // 1. Google confirme-t-il l'identité de la personne ?
    const charge = await this.verifierJetonGoogle(credential);

    // On exige une adresse e-mail confirmée par Google.
    if (!charge.sub || !charge.email || !charge.email_verified) {
      this.logger.warn('Jeton Google sans e-mail confirmé.');
      throw this.refus();
    }
    const email = charge.email.toLowerCase();

    // 2. Cette personne existe-t-elle chez nous ?
    // D'abord par son identifiant Google (connexions habituelles)...
    let utilisateur = await this.utilisateurs.findOneBy({
      googleId: charge.sub,
    });

    if (!utilisateur) {
      // ... sinon par son adresse : c'est sa PREMIÈRE connexion.
      // Elle doit avoir été ajoutée à l'avance (par le super-administrateur ou par
      // l'administrateur de son école) : personne ne peut s'inscrire seul.
      const parEmail = await this.utilisateurs.findOneBy({
        emailGoogle: email,
      });
      if (!parEmail) {
        this.logger.warn(`Connexion refusée : ${email} n'est pas enregistré.`);
        throw this.refus();
      }
      // Cette adresse est déjà liée à UN AUTRE compte Google : on refuse
      // (l'adresse a peut-être changé de propriétaire).
      if (parEmail.googleId && parEmail.googleId !== charge.sub) {
        this.logger.warn(`Connexion refusée : ${email} est liée à un autre compte Google.`);
        throw this.refus();
      }
      // On lie définitivement l'identifiant Google à ce compte.
      parEmail.googleId = charge.sub;
      utilisateur = await this.utilisateurs.save(parEmail);
    }

    // 3. On délivre notre propre session, avec le profil de la personne.
    return {
      jeton: this.creerJeton(utilisateur),
      ...(await this.profil(utilisateur)),
    };
  }

  // ---------------------------------------------------------------------------
  // PROFIL : qui est cette personne, et dans quels établissements a-t-elle un rôle ?
  // ---------------------------------------------------------------------------
  async profil(utilisateur: Utilisateur) {
    const rattachements = await this.membres.find({
      where: { utilisateurId: utilisateur.id },
      relations: { etablissement: true },
    });

    return {
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.emailGoogle,
        estSuperAdmin: utilisateur.estSuperAdmin,
      },
      // La liste complète, y compris les établissements inactifs (l'écran les affichera
      // comme tels, et le serveur refusera d'y travailler).
      etablissements: rattachements.map((m) => ({
        etablissementId: m.etablissementId,
        nom: m.etablissement.nom,
        role: m.role,
        statut: m.etablissement.statut,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // SESSION : à partir du jeton de session (reçu dans l'en-tête Authorization),
  // retrouve l'utilisateur. Utilisé par la garde JwtAuthGuard à CHAQUE requête.
  // ---------------------------------------------------------------------------
  async utilisateurDepuisJeton(jeton: string): Promise<Utilisateur> {
    let charge: { sub?: string };
    try {
      // Vérifie la signature (avec JWT_SECRET) et la date d'expiration.
      charge = await this.jwt.verifyAsync<{ sub?: string }>(jeton);
    } catch {
      throw new UnauthorizedException(
        'Session expirée ou invalide. Reconnectez-vous.',
      );
    }

    // On recharge la personne depuis la base : si elle a été supprimée, elle perd l'accès.
    const utilisateur = charge.sub
      ? await this.utilisateurs.findOneBy({ id: charge.sub })
      : null;
    if (!utilisateur) {
      throw new UnauthorizedException(
        'Session expirée ou invalide. Reconnectez-vous.',
      );
    }
    return utilisateur;
  }

  // ===========================================================================
  // Fonctions internes
  // ===========================================================================

  // Demande à Google de vérifier le jeton : signature, expiration, émetteur, et surtout
  // « audience » = il doit avoir été émis pour NOTRE application (notre Client ID).
  private async verifierJetonGoogle(credential: string): Promise<TokenPayload> {
    try {
      const ticket = await this.clientGoogle.verifyIdToken({
        idToken: credential,
        audience: this.idClientGoogle,
      });
      const charge = ticket.getPayload();
      if (!charge) throw new Error('Jeton sans contenu');
      return charge;
    } catch (erreur) {
      this.logger.warn(
        `Jeton Google invalide : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      );
      throw this.refus();
    }
  }

  // Crée le jeton de session. Il ne contient QUE l'identifiant de la personne :
  // ses droits sont relus dans la base à chaque requête, jamais lus dans le jeton.
  private creerJeton(utilisateur: Utilisateur): string {
    return this.jwt.sign({ sub: utilisateur.id });
  }

  // Refus de connexion : le message est le même pour toutes les causes.
  // La vraie raison est écrite seulement dans le terminal du serveur.
  private refus(): UnauthorizedException {
    return new UnauthorizedException(
      'Connexion refusée : ce compte Google n’est pas autorisé sur sen-evalu.',
    );
  }
}