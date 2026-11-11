import 'dotenv/config'; // Charge le fichier .env (TypeORM 1.0 ne le fait plus seul)
import { DataSource } from 'typeorm';
import { toutesLesEntites } from './entities';

// Configuration utilisée UNIQUEMENT par la ligne de commande des migrations.
// L'application, elle, utilise la configuration de app.module.ts.
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  entities: toutesLesEntites,
  // Dossier où sont rangés les fichiers de migration
  migrations: ['src/database/migrations/*.ts'],
});