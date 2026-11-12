import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// « scrypt » est une fonction de hachage intégrée à Node.js : elle transforme un code
// en une « empreinte » impossible à décoder. On ne garde que l'empreinte en base.
// « promisify » permet de l'utiliser avec « await ».
const scryptAsync = promisify(scrypt) as (
  motDePasse: string,
  sel: Buffer,
  longueur: number,
) => Promise<Buffer>;

// Taille de l'empreinte en octets. Avec le sel, le texte stocké fait 97 caractères
// (la colonne en accepte 100).
const LONGUEUR_EMPREINTE = 32;

// Transforme un code en empreinte « sel:empreinte ».
// Le « sel » est un texte aléatoire propre à chaque code : deux codes identiques
// donnent deux empreintes différentes.
export async function hasherCode(code: string): Promise<string> {
  const sel = randomBytes(16);
  const empreinte = await scryptAsync(code, sel, LONGUEUR_EMPREINTE);
  return `${sel.toString('hex')}:${empreinte.toString('hex')}`;
}

// Vérifie qu'un code saisi correspond à l'empreinte enregistrée.
export async function verifierCode(
  code: string,
  stocke: string | null,
): Promise<boolean> {
  // Pas d'empreinte enregistrée : l'accès est refusé.
  if (!stocke) return false;

  const [selHex, empreinteHex] = stocke.split(':');
  if (!selHex || !empreinteHex) return false;

  // On recalcule l'empreinte du code saisi avec le même sel,
  // puis on compare avec celle enregistrée.
  const attendu = Buffer.from(empreinteHex, 'hex');
  const calcule = await scryptAsync(code, Buffer.from(selHex, 'hex'), attendu.length);

  // « timingSafeEqual » compare en temps constant : on ne peut pas deviner le code
  // en mesurant le temps de réponse.
  return timingSafeEqual(attendu, calcule);
}

// Génère un code lisible de 6 chiffres (ex. « 048213 »), tiré au hasard
// avec le générateur sécurisé de Node.js (pas Math.random).
export function genererCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}