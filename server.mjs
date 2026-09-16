import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';

const root = process.cwd();
const port = Number(process.env.RESISTOLAB_PORT ?? 8000);
const host = process.env.RESISTOLAB_HOST ?? '127.0.0.1';
const mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) {
    response.writeHead(403).end('Accès refusé');
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error('Not found');
    response.writeHead(200, {'Content-Type': mime[extname(file)] ?? 'application/octet-stream'});
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Fichier introuvable');
  }
}).listen(port, host, () => console.log(`Local: http://${host}:${port}`));
