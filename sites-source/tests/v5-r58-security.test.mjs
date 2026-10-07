import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createStockMarket} from '../server/stock-market.mjs';
import {createPortableMarket} from '../server/portable-market.mjs';
import {salaryMateCsp} from '../server/security-policy.mjs';
import {runtime,definition,source,backupFixture,stockView} from './helpers/r57-core.mjs';

// Production functions and native streams only; no browser, DOM emulator or
// network. Fixtures contain no user payroll, holdings or Google credentials.
const plain=value=>JSON.parse(JSON.stringify(value));
const offline=()=>{throw Error('Unexpected network request');};
const req=(body='{}',headers={})=>new Request('https://site.test/api/stocks/quotes',{method:'POST',headers,body});
const marker='<img src=x onerror="void 0" data-audit="salarymate-security">';
const badDate='2026-01-01'+marker;
function appHarness(){
  const c=runtime();
  Object.assign(c,{SCHEMA_VERSION:15,currentYear:2026,newId:p=>p+'-audit',todayIso:()=> '2026-10-06',ui:{selectedYear:2026},SalaryMateI18n:{user:s=>s}});
  const names=['numberValue','wholeNumberFormatter','rateNumberFormatter','hourlyRateNumberFormatter','money','rateNumber','hourlyRateNumber','clamp','clone','escapeHtml','escapeAttr','userHtml','normalizeCustomItems','normalizeFixedEarnings','normalizeEmploymentMode','normalizeHourlyRate','normalizeRegularHours','normalizeSalaryAdjustment','pad2','isoDate','parseDateParts','validIsoDate','addIsoDays','customTotal','companyBaseSalaryProfile','salaryProfileBasePay','salaryProfileTotal','salaryAdjustmentsForCompany','salaryProfileAt','salaryProfileBefore','salaryAdjustmentTotal','salaryAdjustmentReasonName','salaryBasisText','ensureSupportedSchema','validateBackupCollections','renderSalaryAdjustmentsPanel','csvEscape'];
  vm.runInContext(names.map(n=>definition(n)).join('\n')+'\nglobalThis.audit={'+names.join(',')+'};',c);
  c.state=backupFixture(0);
  c.state.companies[0]={id:'c',name:'Synthetic company',isCurrent:true,employmentMode:'monthly',baseSalary:26600,mealAllowance:0,positionAllowance:0,fixedEarnings:[],employmentStartDate:'2020-01-01'};
  c.selectedRaiseCompany=()=>c.state.companies[0];
  return c;
}

test('strict dates reject suffixes, non-strings and invalid calendar days',()=>{
  const {audit:a}=appHarness();
  for(const date of ['2024-02-29','2026-10-06','2020-01-01'])assert.equal(a.validIsoDate(date),true,date);
  for(const date of [badDate,'2026-10-06\n','2026-10-06T12:00:00','2026-02-29','2026-04-31',20261006,{},null])assert.equal(a.validIsoDate(date),false,String(date));
});

test('backup import rejects injected dates before normalization or merge',()=>{
  const c=appHarness(),before=JSON.stringify(c.state);
  const fields={companies:'employmentStartDate',records:'payDate',overtimeLogs:'date',overtime:'date',leaveRecords:'startDate',leaves:'endDate',compTimeCredits:'earnedAt',compTimeSettlements:'date',salaryAdjustments:'effectiveDate'};
  for(const [collection,field] of Object.entries(fields)){
    const incoming=backupFixture(0);incoming[collection]=[{id:'malicious',companyId:'c',[field]:badDate}];
    assert.throws(()=>c.audit.validateBackupCollections(incoming),/INVALID_DATE/,collection);
  }
  assert.equal(JSON.stringify(c.state),before);
});

test('valid older backups, blank optional dates and normal merges remain compatible',()=>{
  const c=appHarness(),incoming=plain(c.state);
  incoming.schemaVersion=13;incoming.companies[0].employmentStartDate='';
  incoming.records=[{id:'p',companyId:'c',year:2026,month:9,payDate:null}];
  incoming.salaryAdjustments=[{id:'r',companyId:'c',effectiveDate:'2026-01-01',baseSalary:30000}];
  c.audit.ensureSupportedSchema(incoming);c.audit.validateBackupCollections(incoming);
  incoming.salaryAdjustments=incoming.salaryAdjustments.map(c.audit.normalizeSalaryAdjustment);
  const next=c.SalaryMateBackup.merge(c.state,incoming,'overwrite','audit').next;
  assert.equal(next.records[0].month,9);assert.equal(next.salaryAdjustments[0].baseSalary,30000);
  assert.equal(next.companies[0].employmentStartDate,'');
});

test('malformed dates in already saved data are not executed or silently rewritten',()=>{
  const c=appHarness();
  c.state.salaryAdjustments=[c.audit.normalizeSalaryAdjustment({id:'bad',companyId:'c',effectiveDate:badDate,baseSalary:90000}),c.audit.normalizeSalaryAdjustment({id:'good',companyId:'c',effectiveDate:'2025-01-01',baseSalary:30000})];
  const before=JSON.stringify(c.state),html=c.audit.renderSalaryAdjustmentsPanel();
  assert.equal(c.audit.salaryProfileAt(c.state.companies[0]).baseSalary,30000);
  assert.ok(!html.includes(marker));assert.equal(JSON.stringify(c.state),before);
});

test('both salary and year-end summaries escape profile dates even after upstream bypass',()=>{
  const c=appHarness();
  const fixture={...c.state.companies[0],effectiveDate:badDate,source:'adjustment'};
  const guarded=vm.createContext({...c.audit,window:{SalaryMateI18n:{user:s=>s}},ui:{selectedYear:2026},state:c.state,selectedRaiseCompany:()=>c.state.companies[0],preferredCompany:()=>c.state.companies[0],todayIso:()=> '2026-10-06',salaryProfileAt:()=>fixture,salaryAdjustmentsForCompany:()=>[],emptyPanel:()=>'',yearEndEstimateFor:()=>({id:'draft',gradeRules:[],note:''}),normalizeYearEndGrades:()=>[],yearEndGradeRowsHtml:()=>'',yearEndResultsHtml:()=>''});
  vm.runInContext(definition('renderSalaryAdjustmentsPanel')+'\n'+definition('renderYearEndPanel')+'\nglobalThis.renderers=[renderSalaryAdjustmentsPanel,renderYearEndPanel];',guarded);
  for(const render of guarded.renderers){const html=render();assert.ok(!html.includes(marker));assert.ok(html.includes('&lt;img'));}
});

test('API rejects unsupported origins, methods and URL-like symbols before upstream access',async()=>{
  const h=createStockMarket(offline);
  assert.equal((await h(new Request('https://site.test/api/stocks/quotes'))).status,405);
  assert.equal((await h(req('{}',{origin:'https://untrusted.invalid'}))).status,403);
  for(const symbol of ['../../x','https://untrusted.invalid','2330<script>'])assert.equal((await h(req(JSON.stringify({instruments:[{market:'TW',symbol}]})))).status,400);
});

test('oversized chunked requests stop and cancel near 16 KB, not after the entire body',async()=>{
  for(const headers of [{},{'content-length':'1'}]){
    let bytes=0,cancelled=false;
    const stream=new ReadableStream({pull(controller){bytes+=4096;controller.enqueue(new Uint8Array(4096).fill(32));},cancel(){cancelled=true;}},{highWaterMark:0});
    const response=await createStockMarket(offline)(new Request('https://site.test/api/stocks/quotes',{method:'POST',body:stream,duplex:'half',headers}));
    assert.equal(response.status,413);assert.equal(bytes,16384);assert.equal(cancelled,true);
  }
});

test('declared oversized bodies are rejected without reading',async()=>{
  let read=false,cancelled=false;
  const body=new ReadableStream({pull(){read=true;},cancel(){cancelled=true;}},{highWaterMark:0});
  const response=await createStockMarket(offline)(new Request('https://site.test/api/stocks/quotes',{method:'POST',headers:{'content-length':'1000000'},body,duplex:'half'}));
  assert.equal(response.status,413);assert.equal(read,false);assert.equal(cancelled,true);
});

test('size limits count UTF-8 bytes and malformed encoding fails safely',async()=>{
  const h=createStockMarket(offline);
  assert.equal((await h(req('{}'+' '.repeat(15998)))).status,400);
  assert.equal((await h(req('{}'+' '.repeat(15999)))).status,413);
  assert.equal((await h(req('中'.repeat(6000)))).status,413);
  assert.equal((await h(req(new Uint8Array([255])))).status,400);
});

test('a stalled request times out and cancels the reader',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let cancelled=false;
  const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}},{highWaterMark:0});
  const pending=createStockMarket(offline)(new Request('https://site.test/api/stocks/quotes',{method:'POST',body,duplex:'half'}));
  t.mock.timers.tick(10001);
  assert.equal((await pending).status,408);assert.equal(cancelled,true);
});

test('missing or malformed IP metadata is limited and windows recover after a minute',async()=>{
  for(const headers of [{},{'cf-connecting-ip':'invalid-ip'},{'cf-connecting-ip':'192.0.2.1'}]){
    let now=1000;const h=createStockMarket(offline,()=>now);
    for(let i=0;i<30;i++)assert.equal((await h(req('{}',headers))).status,400);
    const limited=await h(req('{}',headers));assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
    now+=60001;assert.equal((await h(req('{}',headers))).status,400);
  }
});

test('rotating client metadata still has a bounded per-worker request budget',async()=>{
  const h=createStockMarket(offline,()=>1000);
  for(let i=0;i<600;i++)assert.equal((await h(req('{}',{'cf-connecting-ip':'192.0.2.'+(1+i%21)}))).status,400);
  assert.equal((await h(req('{}',{'cf-connecting-ip':'192.0.2.250'}))).status,429);
});

test('portable market shares body limits and strips credentials',async()=>{
  let captured;
  const proxy=createPortableMarket(async request=>{captured=request;return createStockMarket(offline)(request);});
  const response=await proxy(new Request('https://site.test/api/stocks/portable/quotes',{method:'POST',headers:{origin:'null',authorization:'Bearer synthetic',cookie:'synthetic=1'},body:' '.repeat(17000)}));
  assert.equal(response.status,413);assert.equal(response.headers.get('access-control-allow-origin'),'null');
  assert.equal(captured.headers.get('authorization'),null);assert.equal(captured.headers.get('cookie'),null);
});

test('CSP blocks inline handlers and allows existing Google and portable market endpoints',()=>{
  const web=salaryMateCsp(),portable=salaryMateCsp({portable:true,scriptHashes:["'sha256-test'"],marketOrigin:'https://site.test'});
  assert.match(web,/script-src-attr 'none'/);assert.match(web,/frame-ancestors 'self' https:\/\/chatgpt.com/);
  assert.ok(!web.split(';').find(x=>x.trim().startsWith('script-src ')).includes('unsafe-inline'));
  for(const policy of [web,portable])for(const host of ['https://accounts.google.com/gsi/client','https://accounts.google.com/gsi/style','https://www.googleapis.com'])assert.ok(policy.includes(host));
  assert.match(portable,/sha256-test/);assert.match(portable,/connect-src 'self' https:\/\/site.test /);
  assert.ok(!portable.includes('frame-ancestors'));assert.throws(()=>salaryMateCsp({portable:true}));
});

test('stock names remain escaped and imported icons cannot use scripts or remote URLs',()=>{
  const c=runtime(),book={assets:[{id:'a',symbol:'2330',name:marker,market:'TW',currency:'TWD',account:marker,group:'<img src=x>'}],transactions:[]};
  c.SalaryMateStocks.validate(book);const html=stockView(false,book).render();
  assert.ok(!html.includes(marker));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('onerror="this.remove()"'));
  for(const iconData of ['javascript:void(0)','https://untrusted.invalid/logo.png','data:image/svg+xml;base64,PHN2Zz4='])assert.throws(()=>c.SalaryMateStocks.validate({...book,assets:[{...book.assets[0],iconMode:'custom',iconData}]}));
});

test('CSV export still neutralizes formula prefixes',()=>{
  const c=appHarness();
  for(const input of ['=1+1',' \t=1+1','\n@SUM(1)','+1+1','-1+1']){assert.ok(c.audit.csvEscape(input).startsWith('"\''));assert.ok(c.SalaryMateAnnual.csv([[input]]).startsWith('\uFEFF"\''));}
});

test('encrypted backup still rejects tampering, wrong passwords and altered KDF settings',async()=>{
  const c=runtime();Object.assign(c,{crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  const b=c.SalaryMateBackup,value={companies:[],records:[],synthetic:true},password='audit-only-password';
  const first=await b.encrypt(value,password),second=await b.encrypt(value,password);
  assert.notEqual(first.salt,second.salt);assert.notEqual(first.iv,second.iv);assert.notEqual(first.ciphertext,second.ciphertext);
  assert.deepEqual(plain(await b.decrypt(first,password)),value);
  await assert.rejects(()=>b.decrypt(first,'wrong-password'));
  const bytes=Buffer.from(first.ciphertext,'base64');bytes[0]^=1;
  await assert.rejects(()=>b.decrypt({...first,ciphertext:bytes.toString('base64')},password));
  await assert.rejects(()=>b.decrypt({...first,iterations:999999999},password));
});

test('Drive credentials remain memory-only and redirects/changed ownership are rejected',async()=>{
  const storage=new Map(),calls=[];let mode='initial';
  const file={id:'file_audit',name:'synthetic.json',mimeType:'application/json',ownedByMe:true,trashed:false,appProperties:{salarymate:'salarymate-v5-backup'},size:'2'};
  const c=vm.createContext({URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,Uint8Array,setTimeout,clearTimeout,location:{protocol:'https:',hostname:'site.test'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},SalaryMateBackup:{isEncrypted:()=>false},google:{accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken(){options.callback({access_token:'synthetic-test-token',expires_in:3600});}})}}},fetch:async(url,init)=>{
    calls.push({url,init});const u=new URL(url);assert.equal(u.origin,'https://www.googleapis.com');
    if(u.pathname.endsWith('/about'))return Response.json({user:{permissionId:'synthetic_account'}});
    if(u.pathname.startsWith('/upload/'))return new Response(null,{headers:{location:'https://untrusted.invalid/upload'}});
    if(u.pathname.endsWith('/files'))return Response.json({files:u.searchParams.get('q')?.includes('folder')?[{id:'synthetic_folder'}]:[file]});
    if(u.pathname.endsWith('/file_audit'))return Response.json(mode==='ownership-changed'?{...file,ownedByMe:false}:file);
    throw Error('Unexpected synthetic request');
  }});
  vm.runInContext(source('google-drive.js'),c);const client=c.SalaryMateGoogleDrive.createClient();
  try{
    client.configure('123-audit.apps.googleusercontent.com');await client.connect();
    assert.deepEqual([...storage.keys()],['salarymate_v5_google_client_id']);assert.ok(!JSON.stringify([...storage]).includes('synthetic-test-token'));
    await assert.rejects(()=>client.download('unknown_id'),/重新整理/);
    await client.list();mode='ownership-changed';await assert.rejects(()=>client.download(file.id),/不是此帳戶/);
    mode='initial';await assert.rejects(()=>client.upload({companies:[],records:[]},'audit'),/非 Google Drive/);
    for(const {init} of calls){assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.referrerPolicy,'no-referrer');}
  }finally{client.disconnect();}
  assert.equal(client.status().connected,false);
});
