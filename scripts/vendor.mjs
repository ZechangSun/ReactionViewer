import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/3dmol/build/3Dmol-min.js');
const target = resolve(root, 'media/3Dmol-min.js');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log('Vendored 3Dmol.js into media/3Dmol-min.js');
