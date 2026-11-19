import { IsOptional, IsString, Matches } from 'class-validator';

// Corps (facultatif) des routes « codes/acces » et « codes/sortie ».
// Sans « code » : le serveur en génère un de 6 chiffres.
// Avec « code » : 4 à 20 lettres ou chiffres (sans accent, sans espace).
export class DefinirCodeDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,20}$/, {
    message: 'Le code doit contenir de 4 à 20 lettres ou chiffres.',
  })
  code?: string;
}