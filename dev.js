const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  let target = path.resolve(root, `.${pathname}`);
  if (pathname.endsWith('/')) target = path.join(target, 'index.html');
  if (!target.startsWith(root + path.sep) && target !== path.join(root, 'index.html')) { res.writeHead(403).end('Forbidden'); return; }
  if (!pathname.endsWith('/') && fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.existsSync(path.join(root, '404.html')) ? fs.readFileSync(path.join(root, '404.html')) : 'Not found');
    return;
  }
  const contentType = types[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const fileSize = fs.statSync(target).size;
  const range = req.headers.range;
  if (contentType === 'video/mp4' && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) { res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` }).end(); return; }
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : fileSize - 1;
    if (!match[1] && match[2]) { start = Math.max(0, fileSize - Number(match[2])); end = fileSize - 1; }
    if (start >= fileSize || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` }).end(); return; }
    end = Math.min(end, fileSize - 1);
    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(target, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileSize, 'Accept-Ranges': contentType === 'video/mp4' ? 'bytes' : 'none' });
  fs.createReadStream(target).pipe(res);
}).listen(Number(process.env.PORT || 4173), () => console.log(`Site available at http://localhost:${process.env.PORT || 4173}`));
