'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
// No module evaluation or network work until that feature is requested.
// Concurrent first requests share initialization; a failed load can retry.
function createPublicApis(appPath, load = url => import(url)) {
  const pending = new Map();
  function get(kind) {
    if (!pending.has(kind)) {
      const [file, factory] = kind === 'stock'
        ? ['stock-market.mjs', 'createStockMarket'] : ['reference-api.mjs', 'createReferenceApi'];
      const task = Promise.resolve().then(() => load(pathToFileURL(path.join(appPath, 'api', file)).href))
        .then(module => module[factory]()).catch(error => {pending.delete(kind); throw error;});
      pending.set(kind, task);
    }
    return pending.get(kind);
  }
  return Object.freeze({
    stock: async request => (await get('stock'))(request),
    reference: async request => (await get('reference'))(request)
  });
}
module.exports = {createPublicApis};
