// Emplacement des données brutes Z-Anatomy (FBX, fiches, TA2.csv), en lecture seule.
// Ordre : variable d'environnement SOURCES_ZA, sinon ../sources-za à côté de outils/, sinon le dépôt principal.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const local = path.resolve(ici, '../sources-za');
export const ZA = path.resolve(process.env.SOURCES_ZA || (fs.existsSync(local) ? local : '/Users/toutoune/Downloads/atlas-anatomie/sources-za')) + '/';
