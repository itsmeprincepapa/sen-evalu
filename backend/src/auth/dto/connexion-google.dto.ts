import { IsString, Length } from 'class-validator';

// Données envoyées par le navigateur pour se connecter avec Google.
export class ConnexionGoogleDto {
  // « credential » : le jeton d'identité remis par Google au navigateur (un long texte).
  @IsString()
  @Length(20, 4096)
  credential!: string;
}