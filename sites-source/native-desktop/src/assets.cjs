'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {safeAsset} = require('./security.cjs');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8'};
function createAssetResponder({directory, manifest, fetchFile}) {
  const files = Object.fromEntries(manifest.files.map(file => [file.path, file]));
  return async request => {
    const key = safeAsset(request.url, files);
    if (!key || !['GET','HEAD'].includes(request.method)) return new Response('Not found', {status:404});
    const file = files[key], etag = '"' + file.sha256 + '"';
    const headers = new Headers({
      'Content-Type':types[path.extname(key)] || 'application/octet-stream',
      'Content-Security-Policy':manifest.csp,
      'X-Content-Type-Options':'nosniff',
      // Revalidate on upgrades, without rereading an unchanged bundled asset.
      'Cache-Control':'private, no-cache', 'ETag':etag
    });
    const matches = (request.headers.get('if-none-match') || '').split(',').map(value => value.trim().replace(/^W\//,''));
    if (matches.includes(etag) || matches.includes('*')) return new Response(null, {status:304, headers});
    headers.set('Content-Length', String(file.bytes));
    if (request.method === 'HEAD') return new Response(null, {headers});
    const response = await fetchFile(pathToFileURL(path.join(directory, key)).href);
    if (!response.ok) {headers.delete('Content-Length'); headers.set('Cache-Control','no-store');}
    return new Response(response.body, {status:response.status, headers});
  };
}
module.exports = {createAssetResponder};
