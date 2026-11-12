import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Vérifie automatiquement toutes les données reçues (voir les fichiers dto/) :
  // - whitelist : ignore les champs qui ne sont pas prévus
  // - forbidNonWhitelisted : refuse la requête s'il y a des champs non prévus
  // - transform : convertit les données reçues en objets des classes DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Autorise l'interface React (qui tourne sur un autre port en développement)
  // à appeler ce serveur.
  app.enableCors({ origin: 'http://localhost:5173' });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();