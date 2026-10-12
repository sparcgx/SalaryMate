import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';

const chooseRestore = b => {
  b.click('#backupImportForm [name="mode"][value="restore"]');
  b.click('#backupImportForm [name="restoreAck"]');
};

test('R100 every backup mode rejects nonempty missing company references without changing input', () => {
  const b = boot(fixture());
  try {
    const current = b.state();
    for (const name of ['records','overtimeLogs','leaveRecords','compTimeCredits','compTimeSettlements','salaryAdjustments','yearEndEstimates']) {
      const incoming = structuredClone(current);
      incoming[name] = [{id:'orphan',companyId:'missing-company'}];
      const before = JSON.stringify(current), source = JSON.stringify(incoming);
      for (const mode of ['overwrite','copy','restore']) {
        assert.throws(() => b.w.SalaryMateBackup.merge(current,incoming,mode,'fixture'), /關聯/, `${name}/${mode}`);
        assert.equal(JSON.stringify(current),before);
        assert.equal(JSON.stringify(incoming),source);
      }
    }
  } finally { b.close(); }
});

test('R100 full restore rejects missing overtime and credit references', () => {
  const b = boot(fixture());
  try {
    const current = b.state();
    for (const [name,row] of [
      ['compTimeCredits',{id:'credit',companyId:'A',sourceId:'missing-log'}],
      ['compTimeSettlements',{id:'settlement',companyId:'A',creditId:'missing-credit'}]
    ]) {
      const incoming=structuredClone(current);incoming[name]=[row];
      assert.throws(() => b.w.SalaryMateBackup.merge(current,incoming,'restore','fixture'), /關聯/, name);
    }
  } finally { b.close(); }
});

test('R100 deleting a payroll record leaves independent migrated income restorable from its own backup', async () => {
  const b=boot(fixture());
  try {
    b.tab('records');b.click('[data-action="toggle-record"][data-id="r1"]');
    b.click('[data-action="delete-record"][data-id="r1"]');b.click('[data-action="confirm-action"]');
    const income=b.state().investmentRecords;
    assert.equal(b.state().records.some(row=>row.id==='r1'),false);
    assert.equal(income[0].sourceRecordId,'r1');assert.equal(income[0].amount,1000);
    await b.w.SalaryMateData.importPayload(b.w.SalaryMateData.exportPayload());chooseRestore(b);
    assert.equal(b.q('[data-action="confirm-action"]').disabled,false);b.click('[data-action="confirm-action"]');
    const stored=JSON.parse(b.raw());assert.equal(stored.records.some(row=>row.id==='r1'),false);
    assert.deepEqual(stored.investmentRecords,income);assert.deepEqual(b.errors,[]);
  } finally { b.close(); }
});

test('R100 UI full restore cannot persist a company reference missing from the backup', async () => {
  const b = boot(fixture());
  try {
    const before=b.raw(), incoming=b.state();incoming.records[0].companyId='missing-company';
    await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));chooseRestore(b);
    assert.equal(b.q('[data-action="confirm-action"]').disabled,true);
    assert.match(b.q('#backupImportPreview').textContent,/關聯/);
    b.click('[data-action="confirm-action"]');
    assert.equal(b.raw(),before);assert.equal(b.state().records[0].companyId,'A');
    assert.deepEqual(b.errors,[]);
  } finally { b.close(); }
});

test('R100 complete and empty backups still restore after explicit acknowledgement', async () => {
  for(const empty of [false,true]) {
    const b=boot(fixture());
    try {
      const incoming=empty?{companies:[],records:[]}:b.state();
      if(!empty)incoming.records[0].baseSalary=54321;
      await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));chooseRestore(b);
      assert.equal(b.q('[data-action="confirm-action"]').disabled,false);b.click('[data-action="confirm-action"]');
      const stored=JSON.parse(b.raw());assert.equal(stored.records.length,empty?0:3);
      if(!empty)assert.equal(stored.records[0].baseSalary,54321);
      assert.deepEqual(b.errors,[]);
    } finally { b.close(); }
  }
});

test('R100 legacy aliases, numeric IDs and optional empty references survive normalization and restore', async () => {
  const b=boot(fixture());
  try {
    const legacy={schemaVersion:1,companies:[{id:7,name:'Legacy fixture'}],records:[{id:8,companyId:7,year:2025,month:1,baseSalary:32100}],overtime:[{id:9,companyId:7,date:'2025-01-02',hours:1}],leaves:[{id:10,companyId:7,date:'2025-01-03',type:'annual'}],investmentRecords:[{id:'standalone',date:'2025-01-04',name:'Fixture',amount:10,sourceRecordId:''}]};
    await b.w.SalaryMateData.importPayload(JSON.stringify(legacy));chooseRestore(b);
    assert.equal(b.q('[data-action="confirm-action"]').disabled,false);b.click('[data-action="confirm-action"]');
    const stored=JSON.parse(b.raw());assert.equal(stored.companies[0].id,'7');assert.equal(stored.records[0].companyId,'7');
    assert.equal(stored.overtimeLogs[0].companyId,'7');assert.equal(stored.leaveRecords[0].companyId,'7');assert.equal(stored.investmentRecords[0].sourceRecordId,'');
    assert.deepEqual(b.errors,[]);
  } finally { b.close(); }
});

const compFixture = () => ({...fixture(),
  leaveRecords:[{id:'used',companyId:'A',date:'2026-10-02',type:'compensatory',status:'confirmed',compTimeLinked:true,durationMode:'hours',customHours:2}],
  compTimeCredits:[{id:'credit',sourceId:'ot1',companyId:'A',hours:2,earnedAt:'2026-10-01',expiresAt:'2027-10-01'}],
  compTimeSettlements:[]
});

test('R100 overwrite cannot reduce a credit below retained confirmed compensatory leave', async () => {
  const b=boot(compFixture());
  try {
    const before=b.raw(),incoming=b.state();incoming.compTimeCredits[0].hours=1;incoming.leaveRecords=[];
    await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));
    assert.equal(b.q('[data-action="confirm-action"]').disabled,true);
    assert.match(b.q('#backupImportPreview').textContent,/補休/);b.click('[data-action="confirm-action"]');
    assert.equal(b.raw(),before);assert.equal(b.state().compTimeCredits[0].hours,2);assert.equal(b.state().leaveRecords.length,1);
    assert.deepEqual(b.errors,[]);
  } finally { b.close(); }
});

test('R100 every UI import mode rejects a candidate with compensatory leave exceeding credits', async () => {
  for(const mode of ['overwrite','copy','restore']) {
    const b=boot(compFixture());
    try {
      const before=b.raw(),incoming=b.state();incoming.compTimeCredits[0].hours=1;
      await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));
      b.click(`#backupImportForm [name="mode"][value="${mode}"]`);
      if(mode==='restore')b.click('#backupImportForm [name="restoreAck"]');
      assert.equal(b.q('[data-action="confirm-action"]').disabled,true,mode);
      assert.match(b.q('#backupImportPreview').textContent,/補休/);b.click('[data-action="confirm-action"]');
      assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);
    } finally { b.close(); }
  }
});

test('R100 valid leave imports use candidate company hours, including remapped copies and range half-days', async () => {
  for(const mode of ['overwrite','copy','restore'])for(const variant of [
    {durationMode:'full_day',quantity:1,hours:6},
    {durationMode:'half_am',quantity:1,hours:3},
    {durationMode:'range',startDate:'2026-10-09',endDate:'2026-10-12',startPortion:'pm',endPortion:'am',includeWeekends:false,hours:6},
    {durationMode:'hours',customHours:2.5,hours:2.5}
  ]) {
    const b=boot(compFixture());
    try {
      const incoming=b.state();incoming.companies[0].workHoursPerDay=6;
      incoming.overtimeLogs[0].hours=variant.hours;incoming.compTimeCredits[0].hours=variant.hours;
      incoming.leaveRecords=[{...incoming.leaveRecords[0],...variant}];delete incoming.leaveRecords[0].hours;
      await b.w.SalaryMateData.importPayload(JSON.stringify(incoming));
      b.click(`#backupImportForm [name="mode"][value="${mode}"]`);
      if(mode==='restore')b.click('#backupImportForm [name="restoreAck"]');
      assert.equal(b.q('[data-action="confirm-action"]').disabled,false,`${mode}/${variant.durationMode}`);
      b.click('[data-action="confirm-action"]');
      const stored=JSON.parse(b.raw());assert.equal(stored.compTimeCredits.length,mode==='copy'?2:1);
      assert.equal(stored.leaveRecords.at(-1).compTimeEntries,undefined);
      assert.deepEqual(b.errors,[]);
    } finally { b.close(); }
  }
});
