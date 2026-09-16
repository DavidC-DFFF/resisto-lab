import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const destination = path.join(projectDirectory, 'dist-scorm');
const files = [
  'imsmanifest.xml',
  'index.html',
  'styles.css',
  'app.js',
  'core.js',
  'scorm.js',
  'og.png'
];

await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});

for (const file of files) {
  await cp(path.join(projectDirectory, file), path.join(destination, file));
}

console.log(`Paquet SCORM préparé dans ${destination}`);
