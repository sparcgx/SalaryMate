'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const {MAX_DOCUMENT_BYTES, checkedDocument} = require('./security.cjs');
const VERIFY_CHUNK_BYTES = 256 * 1024;
const fault = code => Object.assign(Error(code), {code});
// Stage beside the chosen destination. Verification failure never replaces it.
async function writeVerified(destination, bytes, io = fs) {
  const temp = path.join(path.dirname(destination), '.' + path.basename(destination) + '.' + randomUUID() + '.tmp');
  let handle, reader;
  try {
    handle = await io.open(temp, 'wx', 0o600);
    const expected = createHash('sha256');
    for (let offset = 0; offset < bytes.length; offset += VERIFY_CHUNK_BYTES) {
      const chunk = bytes.subarray(offset, offset + VERIFY_CHUNK_BYTES);
      await handle.writeFile(chunk); expected.update(chunk);
    }
    await handle.sync(); await handle.close(); handle = null;
    const checksum = expected.digest('hex');
    reader = await io.open(temp, 'r');
    const buffer = Buffer.allocUnsafe(VERIFY_CHUNK_BYTES), actual = createHash('sha256');
    let size = 0;
    for (;;) {
      const {bytesRead} = await reader.read(buffer, 0, buffer.length, size);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > bytes.length) throw fault('SAVE_FAILED');
      actual.update(buffer.subarray(0, bytesRead));
    }
    await reader.close(); reader = null;
    if (size !== bytes.length || actual.digest('hex') !== checksum) throw fault('SAVE_FAILED');
    await io.rename(temp, destination);
    return {verified: true, size: bytes.length, fileName: path.basename(destination), sha256: checksum};
  } finally {
    await handle?.close().catch(() => {});
    await reader?.close().catch(() => {});
    await io.unlink(temp).catch(() => {});
  }
}
function createFileService({dialog, parent, io = fs}) {
  let busy = false;
  async function run(work, fallback) {
    if (busy) return {ok: false, code: 'DOCUMENT_BUSY'};
    busy = true;
    try { return {ok: true, ...await work()}; }
    catch (e) { return {ok: false, code: ['SAVE_CANCELLED','OPEN_CANCELLED','SAVE_INVALID_DOCUMENT','SAVE_EXTENSION_CHANGED','OPEN_INVALID_DOCUMENT'].includes(e.code) ? e.code : fallback}; }
    finally { busy = false; }
  }
  return {
    isBusy: () => busy,
    save: input => run(async () => {
      const doc = checkedDocument(input);
      const choice = await dialog.showSaveDialog(parent(), {title: '儲存 SalaryMate 檔案 / Save SalaryMate file', defaultPath: doc.fileName, filters: [{name: 'SalaryMate', extensions: [doc.extension.slice(1)]}]});
      if (choice.canceled || !choice.filePath) throw fault('SAVE_CANCELLED');
      if (path.extname(choice.filePath).toLowerCase() !== doc.extension) throw fault('SAVE_EXTENSION_CHANGED');
      return writeVerified(choice.filePath, doc.bytes, io);
    }, 'SAVE_FAILED'),
    open: () => run(async () => {
      const choice = await dialog.showOpenDialog(parent(), {title: '選擇 SalaryMate 備份 / Choose backup', properties: ['openFile'], filters: [{name: 'SalaryMate backups', extensions: ['json','salarymate']}]});
      if (choice.canceled || choice.filePaths?.length !== 1) throw fault('OPEN_CANCELLED');
      const selected = choice.filePaths[0];
      if (!['.json','.salarymate'].includes(path.extname(selected).toLowerCase())) throw fault('OPEN_INVALID_DOCUMENT');
      const file = await io.open(selected, 'r');
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_DOCUMENT_BYTES) throw fault('OPEN_FAILED');
        // Read a bounded buffer, even if another process grows the selected file.
        const bytes = Buffer.alloc(stat.size + 1); let size = 0;
        while (size < bytes.length) {
          const read = await file.read(bytes, size, bytes.length - size, size);
          if (!read.bytesRead) break; size += read.bytesRead;
        }
        if (size !== stat.size) throw fault('OPEN_FAILED');
        const data = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes.subarray(0,size));
        return {data, size, fileName: path.basename(selected)};
      } finally { await file.close(); }
    }, 'OPEN_FAILED')
  };
}
module.exports = {writeVerified, createFileService, VERIFY_CHUNK_BYTES};
