import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),base=new URL('assets/public-reference/',root);
function csv(text){return text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>line.split(','));}
const manifest={checkedAt:'2026-10-16',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',license:'https://data.gov.tw/license',sources:{calendar:'https://data.gov.tw/dataset/14718',labor:'https://data.gov.tw/dataset/6258',health:'https://data.gov.tw/dataset/20251'},hashes:{},calendar:{},labor:[],health:[]};
async function file(name){const data=await readFile(new URL(name,base));manifest.hashes[name]=createHash('sha256').update(data).digest('hex');return data.toString('utf8');}
for(const year of [2026,2027]){
 const rows=csv(await file(`calendar-${year}.csv`));
 if(rows.length!==365||new Set(rows.map(r=>r[0])).size!==365)throw Error('Invalid annual calendar');
 manifest.calendar[year]=rows.map(([date,weekday,holiday,note])=>{if(!date.startsWith(String(year))||!['0','2'].includes(holiday))throw Error('Invalid calendar row');return [date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),holiday==='2',note||''];});
}
function range(label){const n=label.match(/\d+/g)?.map(Number);if(!n?.length)throw Error('Unknown bracket range');return {min:/以下/.test(label)?0:n[0],max:/以上/.test(label)?null:n.at(-1)};}
manifest.labor=JSON.parse(await file('labor-2026.json')).map(r=>{if(r['適用起日']!=='1150101')throw Error('Unexpected effective date');return {group:r['身分別'],grade:r['投保薪資等級'],amount:Number(r['月投保薪資']),label:r['月薪資總額'],...range(r['月薪資總額'])};});
manifest.health=csv(await file('health-2026.csv')).map(([group,grade,amount,label])=>({group,grade,amount:Number(amount),label,...range(label)}));
if(manifest.labor.length!==97||manifest.health.length!==58)throw Error('Incomplete insurance tables');
await writeFile(new URL('dist/dev/v5.0.0-dev.2/reference-data.js',root),'globalThis.SalaryMateReferenceData=Object.freeze('+JSON.stringify(manifest)+');\n');
console.log('Public reference snapshots: 730 calendar dates, 97 labor rows, 58 health rows.');
