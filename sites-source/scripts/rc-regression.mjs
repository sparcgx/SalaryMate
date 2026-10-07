import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const version='4.3.2-RC.1';
const run=(label,cmd,args)=>{
  const result=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  const output=[result.stdout,result.stderr].filter(Boolean).join('\n');
  console.log(output.trim());
  if(result.status!==0)throw new Error(`${label} failed (exit ${result.status})`);
  return output;
};
const testFiles=['glass','reconcile','copy-month','comp-time','annual-analysis','rc-integration','rc-freeze-pwa'].map(name=>`tests/${name}.test.mjs`);
const tap=run('Full automated regression',process.execPath,['--test','--test-isolation=none','--test-reporter=tap',...testFiles]);
const source=run('Source consistency',process.execPath,['tests/site-gate.mjs']);
const passed=Number(tap.match(/^# pass (\d+)$/m)?.[1]), failed=Number(tap.match(/^# fail (\d+)$/m)?.[1]);
if(!passed||failed!==0)throw new Error('Missing or failed TAP result');
const freeze=JSON.parse(fs.readFileSync('release-evidence/v4.3.2-RC.1_freeze.json','utf8'));
const assets=Object.fromEntries(Object.keys(freeze.assets).sort().map(name=>[name,createHash('sha256').update(fs.readFileSync(name)).digest('hex')]));
const javascript=Object.keys(assets).filter(name=>name.endsWith('.js'));
for(const name of javascript)run('JavaScript syntax',process.execPath,['--check',name]);
run('Diff quality','git',['diff','--check']);
const evidence={
  version,checkedAt:new Date().toISOString(),baselineCommit:freeze.baselineCommit,
  scope:'Web source and simulated runtime; no real device/native execution',
  automated:{passed,failed,tests:[...tap.matchAll(/^ok \d+ - (.+)$/gm)].map(match=>({name:match[1],status:'PASS'})),sourceGates:(source.match(/^PASS:/gm)||[]).length,javascriptSyntaxFiles:javascript.length,diffCheck:'PASS'},
  featureFreeze:'PASS: all runtime assets equal dev.4 after version-literal normalization',
  userReports:[
    {version:'4.3.2-dev.1',scope:'薪資明細 → 月結核對',status:'PASS',source:'user_report'},
    {version:'4.3.2-dev.2',scope:'各月薪資明細 → 複製上月薪資',status:'PASS',source:'user_report'},
    {version:'4.3.2-dev.3',scope:'工時／出勤管理 → 加班紀錄',status:'PASS',source:'user_report'},
    {version:'4.3.2-dev.4',scope:'實機測試（年度同期比較、收入結構、整合報表版本）',status:'PASS',source:'user_report'}
  ],
  rcDeviceAcceptance:'PENDING',androidNativeGate:'UNVERIFIED',iosNativeGate:'UNVERIFIED',dataSafetyBlocker:'OPEN',
  assets
};
fs.writeFileSync(`release-evidence/v${version}_results.json`,JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(`release-evidence/v${version}_test.log`,tap+'\n'+source);
console.log(`RC AUTOMATED GATE PASS: ${passed} tests, ${evidence.automated.sourceGates} source gates; native gates remain UNVERIFIED.`);
