'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const {writeVerified} = require('./files.cjs');
const {MAX_DOCUMENT_BYTES} = require('./security.cjs');
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const SHORTCUTS = ['CommandOrControl+Shift+M','CommandOrControl+Alt+M','CommandOrControl+Shift+Y'];
const defaults = () => ({version:1, deviceId:randomUUID(), directory:'', enabled:false, intervalMinutes:15, retention:30, shortcutEnabled:false, shortcut:SHORTCUTS[0]});
const fault = code => Object.assign(Error(code), {code});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function checkedOptions(input) {
  if (!input || Object.keys(input).some(k => !['enabled','intervalMinutes','retention','shortcutEnabled','shortcut'].includes(k)) || typeof input.enabled !== 'boolean' || typeof input.shortcutEnabled !== 'boolean' || ![5,15,60].includes(input.intervalMinutes) || ![10,30,60].includes(input.retention) || !SHORTCUTS.includes(input.shortcut)) throw fault('INVALID_OPTIONS');
  return {enabled:input.enabled,intervalMinutes:input.intervalMinutes,retention:input.retention,shortcutEnabled:input.shortcutEnabled,shortcut:input.shortcut};
}
function checkedPayload(text) {
  if (typeof text !== 'string' || !text.length || text.length > MAX_DOCUMENT_BYTES || Buffer.byteLength(text) > MAX_DOCUMENT_BYTES) throw fault('INVALID_BACKUP');
  let raw; try {raw = JSON.parse(text);} catch {throw fault('INVALID_BACKUP');}
  const keys = ['companies','records','overtimeLogs','leaveRecords','investmentRecords','compTimeCredits','compTimeSettlements','yearEndEstimates','salaryAdjustments'];
  if (raw?.schemaVersion !== 15 || keys.some(k => !Array.isArray(raw[k])) || !Array.isArray(raw.stockPortfolio?.assets) || !Array.isArray(raw.stockPortfolio?.transactions)) throw fault('INVALID_BACKUP');
  const summary = Object.fromEntries(keys.map(k => [k,raw[k].length]));
  summary.assets = raw.stockPortfolio.assets.length; summary.transactions = raw.stockPortfolio.transactions.length;
  // Export timestamps do not create redundant versions of unchanged data.
  const {exportInfo, updatedAt, ...content} = raw;
  return {bytes:Buffer.from(text), digest:hash(JSON.stringify(content)), summary};
}
async function readBounded(file, maximum, io=fs) {
  const before = await io.lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maximum) throw fault('BACKUP_UNREADABLE');
  const handle = await io.open(file,'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== before.size || stat.ino !== before.ino) throw fault('BACKUP_UNREADABLE');
    const buffer = Buffer.alloc(stat.size + 1); let size=0;
    while (size < buffer.length) {const r=await handle.read(buffer,size,buffer.length-size,size);if(!r.bytesRead)break;size+=r.bytesRead;}
    if (size !== stat.size) throw fault('BACKUP_UNREADABLE');
    return buffer.subarray(0,size);
  } finally {await handle.close();}
}
function createBackupService({userData, chooseDirectory, io=fs, now=()=>new Date()}) {
  const configFile=path.join(userData,'desktop-preferences.json');
  let config, loading, busy=false;
  async function load() {
    if(config)return config;
    if(!loading)loading=(async()=>{
      let value;
      try {value=JSON.parse((await readBounded(configFile,32768,io)).toString('utf8'));}
      catch(e){if(e.code!=='ENOENT')throw fault('PREFERENCES_UNREADABLE');value=defaults();await io.mkdir(userData,{recursive:true});await writeVerified(configFile,Buffer.from(JSON.stringify(value)),io);}
      checkedOptions({enabled:value.enabled,intervalMinutes:value.intervalMinutes,retention:value.retention,shortcutEnabled:value.shortcutEnabled,shortcut:value.shortcut});
      if(value.version!==1||!ID.test(value.deviceId)||typeof value.directory!=='string'||(value.directory&&!path.isAbsolute(value.directory)))throw fault('PREFERENCES_UNREADABLE');
      return config=value;
    })().finally(()=>{loading=null;});
    return loading;
  }
  async function exclusive(work) {
    if(busy)throw fault('DESKTOP_BUSY');busy=true;
    try{await load();return await work();}finally{busy=false;}
  }
  async function store(value) {await writeVerified(configFile,Buffer.from(JSON.stringify(value)),io);config=value;return {...value};}
  async function folder() {
    if(!config.directory)throw fault('BACKUP_NOT_CONFIGURED');
    const selected=await io.realpath(config.directory);
    if(selected!==config.directory)throw fault('BACKUP_UNREADABLE');
    const destination=path.join(selected,'SalaryMate-Backups',config.deviceId);
    await io.mkdir(destination,{recursive:true,mode:0o700});
    if(await io.realpath(destination)!==destination)throw fault('BACKUP_UNREADABLE');
    return destination;
  }
  async function history(dir) {
    let value;
    try{value=JSON.parse((await readBounded(path.join(dir,'history.json'),1024*1024,io)).toString('utf8'));}
    catch(e){if(e.code==='ENOENT')return [];throw fault('HISTORY_UNREADABLE');}
    if(value.version!==1||!Array.isArray(value.entries)||value.entries.length>1000)throw fault('HISTORY_UNREADABLE');
    const ids=new Set();
    for(const item of value.entries){
      if(!ID.test(item.id)||ids.has(item.id)||!HASH.test(item.sha256)||!HASH.test(item.digest)||!Number.isSafeInteger(item.size)||item.size<1||item.size>MAX_DOCUMENT_BYTES||!Number.isFinite(Date.parse(item.createdAt))||!['auto','manual','before-import'].includes(item.reason))throw fault('HISTORY_UNREADABLE');
      ids.add(item.id);
    }
    return value.entries;
  }
  return {
    isBusy:()=>busy,
    options:async()=>({...await load()}),
    setOptions:input=>exclusive(async()=>{const options=checkedOptions(input);if(options.enabled&&!config.directory)throw fault('BACKUP_NOT_CONFIGURED');return store({...config,...options});}),
    choose:()=>exclusive(async()=>{
      const selected=await chooseDirectory();if(!selected)throw fault('OPEN_CANCELLED');
      const directory=await io.realpath(selected),stat=await io.stat(directory);if(!stat.isDirectory())throw fault('BACKUP_UNREADABLE');
      // Selecting a location does not silently enable plaintext backups.
      return store({...config,directory,enabled:false});
    }),
    list:()=>exclusive(async()=>{if(!config.directory)return [];return history(await folder());}),
    save:input=>exclusive(async()=>{
      if(!input||!['auto','manual','before-import'].includes(input.reason))throw fault('INVALID_BACKUP');
      if(!config.enabled&&input.reason!=='manual')return {skipped:true,disabled:true};
      const payload=checkedPayload(input.data),dir=await folder(),entries=await history(dir);
      if(input.reason==='auto'&&entries[0]?.digest===payload.digest){
        // A removed/corrupted latest file must not suppress a replacement.
        try{const prior=await readBounded(path.join(dir,entries[0].id+'.json'),MAX_DOCUMENT_BYTES,io);if(hash(prior)===entries[0].sha256)return {skipped:true,entry:entries[0]};}catch{}
      }
      const entry={id:randomUUID(),createdAt:now().toISOString(),reason:input.reason,sha256:hash(payload.bytes),digest:payload.digest,size:payload.bytes.length,summary:payload.summary};
      const destination=path.join(dir,entry.id+'.json');
      await writeVerified(destination,payload.bytes,io);
      const all=[entry,...entries],kept=all.slice(0,config.retention);
      try{await writeVerified(path.join(dir,'history.json'),Buffer.from(JSON.stringify({version:1,entries:kept})),io);}
      catch(e){await io.unlink(destination).catch(()=>{});throw e;}
      // Retention only deletes this installation's explicitly indexed versions,
      // and only after the new snapshot and index both passed verification.
      let cleanupPending=0;
      for(const old of all.slice(config.retention))try{await io.unlink(path.join(dir,old.id+'.json'));}catch(e){if(e.code!=='ENOENT')cleanupPending++;}
      return {verified:true,entry,cleanupPending};
    }),
    read:id=>exclusive(async()=>{
      if(!ID.test(id))throw fault('INVALID_BACKUP');
      const dir=await folder(),entry=(await history(dir)).find(e=>e.id===id);if(!entry)throw fault('BACKUP_UNREADABLE');
      const bytes=await readBounded(path.join(dir,id+'.json'),MAX_DOCUMENT_BYTES,io);
      if(bytes.length!==entry.size||hash(bytes)!==entry.sha256)throw fault('BACKUP_INTEGRITY');
      const data=new TextDecoder('utf-8',{fatal:true}).decode(bytes);checkedPayload(data);
      return {data,entry,verified:true};
    })
  };
}
module.exports={createBackupService,checkedPayload,checkedOptions,readBounded,SHORTCUTS};
