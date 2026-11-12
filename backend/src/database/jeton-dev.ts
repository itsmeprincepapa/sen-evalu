import 'dotenv/config'; // Charge le fichier .env
import { JwtService } from '@nestjs/jwt';
import { DUREE_SESSION_SECONDES } from '../auth/constantes';
import dataSource from './data-source';
import { Utilisateur } from './entities/utilisateur.entity';

// Commande de DÉVELOPPEMENT : fabrique une session pour un utilisateur existant, afin de
// tester les routes protégées avant d'avoir les écrans de connexion.
// Usage : npm run jeton-dev -- adresse@gmail.com
// Elle est INTERDITE en production.

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Commande interdite en production.');
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET manque dans le fichier .env.');

  const email = process.argv[2];
  if (!email) {
    console.error('Usage : npm run jeton-dev -- adresse@gmail.com');
    process.exit(1);
  }

  await dataSource.initialize();
  try {
    const utilisateur = await dataSource
      .getRepository(Utilisateur)
      .findOneBy({ emailGoogle: email.trim().toLowerCase() });
    if (!utilisateur) throw new Error(`Aucun utilisateur avec l'adresse ${email}.`);

    // Même réglage que le vrai serveur (voir auth.module.ts).
    const jwt = new JwtService({
      secret,
      signOptions: { expiresIn: DUREE_SESSION_SECONDES },
    });
    console.log(jwt.sign({ sub: utilisateur.id }));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});