import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const version=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
import {boot, element, PAYROLL_KEY} from './helpers/app-runtime.mjs';

const fixture = () => ({schemaVersion:13,companies:[{id:'A',name:'甲公司',isCurrent:true},{id:'B',name:'乙公司',isCurrent:false}],
  records:[{id:'a26',companyId:'A',year:2026,month:9,baseSalary:47000,sideIncome:1000},{id:'a25',companyId:'A',year:2025,month:9,baseSalary:40000},{id:'b26',companyId:'B',year:2026,month:9,baseSalary:90000}],
  overtimeLogs:[{id:'otA',companyId:'A',date:'2026-09-15',hours:2,hourlyRate:200,type:'weekday'}],
  compTimeCredits:[{id:'creditA',companyId:'A',sourceId:'otA',earnedAt:'2026-09-15',hours:1,expiresAt:'2027-09-15'}],
  compTimeSettlements:[{id:'settleA',companyId:'A',creditId:'creditA',date:'2026-09-20',hours:.5,amount:150,note:'人工結算'}]
});
const business = data => Object.fromEntries(['companies','records','overtimeLogs','leaveRecords','compTimeCredits','compTimeSettlements','salaryAdjustments','yearEndEstimates'].map(key => [key,data[key]]));

test('RC：Schema 13 載入與所有主要頁面不改寫原始薪資', () => {
  const seed=fixture(), runtime=boot(seed), original=runtime.storage.get(PAYROLL_KEY);
  for(const tab of ['dashboard','records','overtime','tax','companies','hourly']) { runtime.tab(tab); assert(runtime.elements.get('mainContent').innerHTML.length>100); }
  assert.equal(runtime.storage.get(PAYROLL_KEY),original);
  assert.equal(runtime.state().records.length,3);
  assert.equal(runtime.state().compTimeSettlements[0].amount,150);
  assert.equal(runtime.state().exportInfo.appVersion,version);
});

test('RC：整合 CSV 與列印 HTML 下載遵循公司、年份、截止月且不重複計入補休結算', async () => {
  const runtime=boot(fixture()); runtime.change('yearFilter','2026'); runtime.change('annualThroughMonth','9');
  const before=runtime.storage.get(PAYROLL_KEY);
  runtime.action('export-annual-report'); runtime.action('download-annual-print');
  assert.equal(runtime.downloads.length,2);
  const csv=await runtime.downloads[0].blob.text(), html=await runtime.downloads[1].blob.text();
  assert.equal(runtime.downloads[0].filename,'SalaryMate_2026_01-09_integrated.csv');
  assert.equal(runtime.downloads[1].filename,'SalaryMate_2026_01-09_report.html');
  assert(csv.includes('"2026","9","1","47000","0","47000","1000","48000"'));
  assert(csv.includes('"150"')); assert(!csv.includes('48150'));
  assert(html.includes('1～9 月')); assert(html.includes('48,000')); assert(!html.includes('48,150'));
  assert(html.includes('window.print()')); assert(!/\b(?:src|href)=["']https?:/i.test(html));
  assert.equal(runtime.storage.get(PAYROLL_KEY),before);
  runtime.change('companyFilter','B'); runtime.action('export-annual-report');
  const selected=await runtime.downloads.at(-1).blob.text();
  assert(selected.includes('乙公司')); assert(selected.includes('"2026","9","1","90000"')); assert(!selected.includes('"48000"'));
});

test('RC：JSON 備份確認前不寫入，還原與重新啟動保留核對、來源及結算', async () => {
  const seed=fixture(); seed.records[0].reconciliation={actual:{net:47000},reason:'測試核對',fingerprint:'fixture',reviewed:false};
  const source=boot(seed); source.action('export-json');
  const backup=await source.downloads[0].blob.text();
  const target=boot(); const before=target.storage.get(PAYROLL_KEY);
  await target.window.SalaryMateData.importPayload(backup);
  assert.equal(target.storage.get(PAYROLL_KEY),before);
  assert(target.elements.get('dialogContent').innerHTML.includes('確認還原'));
  target.action('confirm-action');
  assert.deepEqual(business(target.state()),business(source.state()));
  const restarted=boot(target.storage.get(PAYROLL_KEY));
  assert.deepEqual(business(restarted.state()),business(source.state()));
});

test('RC：損毀備份與寫入失敗時保持現有資料，恢復寫入後可重試', async () => {
  const runtime=boot(fixture()), before=runtime.storage.get(PAYROLL_KEY), domain=business(runtime.state());
  await runtime.window.SalaryMateData.importPayload('{broken');
  assert.equal(runtime.storage.get(PAYROLL_KEY),before); assert.deepEqual(business(runtime.state()),domain);
  const replacement=fixture(); replacement.records[0].baseSalary=1;
  await runtime.window.SalaryMateData.importPayload(JSON.stringify(replacement));
  runtime.controls.failWrites=true; runtime.action('confirm-action');
  assert.equal(runtime.storage.get(PAYROLL_KEY),before); assert.deepEqual(business(runtime.state()),domain);
  assert(runtime.elements.get('toast').textContent.includes('失敗'));
  runtime.controls.failWrites=false;
  await runtime.window.SalaryMateData.importPayload(JSON.stringify(replacement)); runtime.action('confirm-action');
  assert.equal(runtime.state().records[0].baseSalary,1);
});

test('RC：核對確認保存，切換公司後舊草稿不得保存', () => {
  const seed=fixture(); seed.overtimeLogs=[];seed.compTimeCredits=[];seed.compTimeSettlements=[];
  const runtime=boot(seed); runtime.action('reconcile-record','a26');
  runtime.elements.set('reconciliationForm',element('reconciliationForm'));
  runtime.elements.set('reconcileFeedback',element('reconcileFeedback'));
  runtime.queries.set('[data-reconcile-key]',runtime.window.SalaryMateReconcile.rows(runtime.state().records[0]).map(row=>({value:String(row.expected),dataset:{reconcileKey:row.key}})));
  runtime.submit('reconciliationForm','confirm');
  assert.equal(runtime.state().records[0].reconciliation.reviewed,true);
  const reviewed=runtime.state().records[0].reconciliation;
  runtime.action('reconcile-record','a26'); runtime.change('companyFilter','B');
  runtime.submit('reconciliationForm','confirm');
  assert.deepEqual(runtime.state().records[0].reconciliation,reviewed);
  assert.equal(runtime.state().records[1].reconciliation,null);
  assert.equal(runtime.state().records[2].reconciliation,null);
});

test('RC：報表中的公司名稱經 HTML 跳脫及 CSV 公式防護', async () => {
  const seed=fixture(); seed.companies[1].name=' =1+1<img src=x onerror=alert(1)>';
  const runtime=boot(seed); runtime.change('companyFilter','B');
  runtime.action('export-annual-report'); runtime.action('download-annual-print');
  const csv=await runtime.downloads[0].blob.text(), html=await runtime.downloads[1].blob.text();
  assert(csv.includes('"\' =1+1<img'));
  assert(html.includes('&lt;img src=x onerror=alert(1)&gt;')); assert(!html.includes('<img src=x'));
});
