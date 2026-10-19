'use strict';
const path = require('node:path');
const {isUint8Array, isSharedArrayBuffer} = require('node:util').types;
const MAX_DOCUMENT_BYTES = 45 * 1024 * 1024;
const APP_URL = 'salarymate://app/index.html';
const STOCK_PATHS = new Set(['quotes', 'nav', 'lookup', 'dividends', 'catalog'].map(x => '/api/stocks/' + x));
function localURL(value) {
  try { const u = new URL(value); return u.protocol === 'salarymate:' && u.host === 'app' && !u.username && !u.password; }
  catch { return false; }
}
function documentURL(value) {
  if (!localURL(value)) return false;
  const u = new URL(value); return ['/', '/index.html'].includes(u.pathname);
}
function safeAsset(value, files) {
  if (!localURL(value)) return null;
  let key;
  try { key = decodeURIComponent(new URL(value).pathname); } catch { return null; }
  if (key === '/') key = '/index.html';
  if (key.includes('\\') || key.includes('\0') || key.split('/').some(x => x === '..' || x === '.')) return null;
  key = key.slice(1);
  return Object.hasOwn(files, key) ? key : null;
}
function checkedDocument(input) {
  const fail = () => { throw Object.assign(Error('Invalid document'), {code: 'SAVE_INVALID_DOCUMENT'}); };
  if (!input || typeof input.fileName !== 'string' || input.fileName.length > 180 || input.fileName !== path.basename(input.fileName) || /[\\/:\x00-\x1f]/.test(input.fileName)) fail();
  const extension = path.extname(input.fileName).toLowerCase();
  if (!['.json', '.salarymate', '.csv', '.html'].includes(extension)) fail();
  let bytes;
  if (input.encoding === 'bytes') {
    if (!isUint8Array(input.data) || isSharedArrayBuffer(input.data.buffer) || !input.data.byteLength || input.data.byteLength > MAX_DOCUMENT_BYTES) fail();
    // IPC structured-clones this buffer into the main process. Reuse that
    // owned copy, honoring slices; never accept renderer filesystem access.
    bytes = Buffer.from(input.data.buffer, input.data.byteOffset, input.data.byteLength);
  } else if (input.encoding === 'utf8') {
    if (typeof input.data !== 'string' || !input.data.length) fail();
    if (input.data.length > MAX_DOCUMENT_BYTES || Buffer.byteLength(input.data) > MAX_DOCUMENT_BYTES) fail();
    bytes = Buffer.from(input.data, 'utf8');
  } else if (input.encoding === 'base64') {
    if (typeof input.data !== 'string' || !input.data.length) fail();
    if (input.data.length > 4 * Math.ceil(MAX_DOCUMENT_BYTES / 3) || input.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) fail();
    bytes = Buffer.from(input.data, 'base64');
    if (bytes.toString('base64') !== input.data) fail();
  } else fail();
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) fail();
  return {bytes, extension, fileName: input.fileName};
}
function publicApiPath(value) {
  if (!localURL(value)) return null;
  const u = new URL(value);
  if (STOCK_PATHS.has(u.pathname) || u.pathname === '/api/reference/fx') return u.pathname + u.search;
  return null;
}
module.exports = {MAX_DOCUMENT_BYTES, APP_URL, STOCK_PATHS, localURL, documentURL, safeAsset, checkedDocument, publicApiPath};
