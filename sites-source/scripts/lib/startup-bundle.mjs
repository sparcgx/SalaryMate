import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

// Preserve the original deferred module order and individual source files.
export const startupModules=Object.freeze(['i18n-en.js','i18n.js','reconcile.js','copy-month.js','comp-time.js','annual-analysis.js','bootstrap.js','stocks.js','stocks-integrations.js','backup.js','google-drive.js','google-drive-ui.js','stocks-ui.js','app.js']);
export async function buildStartupBundle(base){
 const parts=await Promise.all(startupModules.map(async name=>({name,source:await readFile(path.join(base,name),'utf8')})));
 const source=parts.map(({name,source})=>`\n;/* SalaryMate module: ${name} */\n${source}\n`).join('');
 new vm.Script(source,{filename:'startup.js'});
 await writeFile(path.join(base,'startup.js'),source);
 return {modules:parts.length,bytes:Buffer.byteLength(source)};
}
