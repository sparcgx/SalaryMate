import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const rows=fs.readFileSync(path.join(root,'locales/en.tsv'),'utf8').split('\n').filter(Boolean);
const catalog=Object.fromEntries(rows.map(row=>{const i=row.indexOf('|');if(i<1)throw new Error('Invalid translation row: '+row);return [row.slice(0,i).trim(),row.slice(i+1).trim()];}));
fs.writeFileSync(path.join(root,'dist/dev/v5.0.0-dev.2/i18n-en.js'),'globalThis.SalaryMateEnglish='+JSON.stringify(catalog,null,2)+';\n');
console.log(`English catalog: ${Object.keys(catalog).length} entries.`);
