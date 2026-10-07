import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the production functions directly, without launching a browser.
const source = fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/app.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const names = [
  'LEAVE_TYPES',
  'numberValue','wholeNumberFormatter','rateNumberFormatter','hourlyRateNumberFormatter','money','clamp','clone','escapeHtml','escapeAttr','rateNumber','hourlyRateNumber',
  'normalizeCustomItems','normalizeFixedEarnings','normalizeFixedDeductions','normalizeEmploymentMode','normalizeHourlyRate','normalizeRegularHours','normalizeCompany','normalizeRecord','normalizeSalaryAdjustment','normalizeOvertime',
  'customTotal','hourlyCustomTotal','roundHourlyRate','companyBaseSalaryProfile','salaryProfileBasePay','salaryProfileTotal','salaryAdjustmentsForCompany','salaryProfileAt','salaryProfileBefore','salaryProfileOvertimeBasis','overtimeHourlyRate','recordHourlyBase',
  'calculatorProfileDate','applyCompanyDefaultsToCalculator','companyFixedEarningsForRecord','companyFixedDeductionsForRecord','applyCompanyDefaultsToRecord','currentCompanySalaryProfile',
  'blankCompanyBasicDraft','companyBasicFixedEarnings','companyBasicSalaryProfile','companySalaryFingerprint','companyBasicMoneyInput','companyBasicFixedRowsHtml','companyBasicCalculationHtml','companyBasicFormHtml',
  'collectCompanyBasicDraft','updateCompanyBasicPreview','commitCompanyBasicDraft','saveCompanyBasicForm','currentSalaryAdjustmentForDate','upsertCurrentSalaryRuleProfile',
  'companyOvertimeRate','blankOvertime','collectOvertimeDraft','useCompanyOvertimeRate','updateOvertimePreview','overtimeAmount','roundOvertimeTotal','overtimeTotal','leaveWageDeduction',
  'gross','deductions','pension','mainNet','moneyInput','defaultPayDate','blankRecord','syncLeaveToRecord',
  'companyRuleItemRowsHtml','companyRuleItemsTotalsHtml','defaultDeductionRuleFormHtml','openDefaultDeductionRule','collectDefaultDeductionRuleDraft','saveDefaultDeductionRule'
];
function definition(name) {
  const start = source.indexOf(`    const ${name} =`);
  assert.ok(start >= 0, `Missing production function: ${name}`);
  const tail = source.slice(start);
  const end = tail.slice(1).search(/\n    const /);
  return end < 0 ? tail : tail.slice(0, end + 1);
}
function setup() {
  let serial = 0;
  const elements = new Map(), errors = [], messages = [];
  const context = {
    window: {},
    state: { companies: [], salaryAdjustments: [], overtimeLogs: [], records: [], hourlySettings: {standardHours:174}, overtimeCalculator:{companyId:'',overtimeDivisor:240} },
    ui: {hourlyMonth:0,selectedYear:2026}, currentYear:2026,
    DEFAULT_DEDUCTION_RULE:'test rule',
    todayIso: () => '2026-10-05', v5WorkDate: () => '2026-10-05',
    newId: prefix => `${prefix}_${++serial}`,
    validIsoDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value || ''),
    addIsoDays: (date, days) => new Date(Date.parse(date+'T00:00:00Z') + days*86400000).toISOString().slice(0,10),
    normalizeLeavePolicies: value => structuredClone(value || {}), defaultLeavePolicies: () => ({}),
    salaryPeriodBounds: (year,month) => ({start:`${year}-${String(month).padStart(2,'0')}-01`,end:`${year}-${String(month).padStart(2,'0')}-28`}),
    salaryMonthForLog: log => ({year:2026,month:Number(log.date.slice(5,7))}),
    calculationCache:{creditHours:new Map([['index',new Map()]])},
    leaveHours: record => record.hours,
    $: selector => elements.get(selector) || null,
    FormData: class { constructor(form) {this.data=form.fields;} get(key) {return this.data.get(key) ?? null;} has(key) {return this.data.has(key);} },
    commitStateMutation: fn => {fn(); return true;},
    closeDialog:()=>{}, renderAll:()=>{}, markDraftDirty:()=>{}, beginDraftScope:()=>{},
    toast: text => messages.push(text), openDialog:(...args)=>messages.push(args),
    validateNativeForm:()=>true, assertDraftScope:()=>true,
    validateField:(_,field,message)=>errors.push({field,message}), setFieldValidation:()=>{},
    showValidationSummary:(_,message)=>errors.push({message}),
    confirm:(_title,_message,callback)=>callback(), salaryPeriodLabel:()=> 'selected period',
  };
  context.getCompany = id => context.state.companies.find(c=>c.id===id);
  context.currentCompany = () => context.state.companies.find(c=>c.isCurrent);
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/reconcile.js',import.meta.url),'utf8'),context);
  vm.runInContext(names.map(definition).join('\n') + `\nglobalThis.api={${names.join(',')}};`, context);
  const a = context.api;
  const company = a.normalizeCompany({id:'A',name:'Test Company',isCurrent:true,employmentStartDate:'2020-02-24',baseSalary:26600,mealAllowance:3000,positionAllowance:1000,fixedEarnings:[{id:'night',name:'夜班津貼',amount:1000},{id:'attendance',name:'全勤',amount:400}],leavePolicies:{annual:{mode:'custom',quotaDays:10}}});
  context.state.companies.push(company);
  const formFor = draft => {
    const fields = new Map(Object.entries(draft).filter(([,v])=>typeof v !== 'object').map(([k,v])=>[k,String(v)]));
    draft.fixedEarnings?.forEach((item,i)=>{fields.set(`basicFixed_${i}_name`,item.name);fields.set(`basicFixed_${i}_amount`,String(item.amount));});
    return {fields,querySelectorAll:()=>draft.fixedEarnings?.map((_,i)=>({dataset:{index:String(i)}})) || [],elements:{namedItem:()=>({})}};
  };
  const ruleFormFor = draft => {
    const fields=new Map([['laborIns',String(draft.laborIns)],['healthIns',String(draft.healthIns)]]);
    for(const [items,prefix] of [[draft.fixedEarnings,'ruleEarning'],[draft.fixedDeductions,'ruleDeduction']])items.forEach((item,i)=>{fields.set(`${prefix}_${i}_name`,item.name);fields.set(`${prefix}_${i}_amount`,String(item.amount));});
    const form={fields,querySelectorAll:selector=>(selector.includes('"earning"')?draft.fixedEarnings:draft.fixedDeductions).map((_,i)=>({dataset:{index:String(i)}}))};
    elements.set('#defaultDeductionRuleForm',form);return form;
  };
  return {...a,context,state:context.state,ui:context.ui,company,elements,errors,formFor,ruleFormFor};
}

test('loads the currently effective profile; night and duplicate names retain IDs and amounts',()=>{
  const a=setup();
  const fixed=[{id:'one',name:'全勤',amount:1000},{id:'night-1',name:'夜班津貼',amount:2000},{id:'night-2',name:'夜班津貼',amount:500}];
  a.state.salaryAdjustments.push(a.normalizeSalaryAdjustment({id:'raise',companyId:'A',effectiveDate:'2026-09-01',baseSalary:30000,mealAllowance:3000,positionAllowance:4000,fixedEarnings:fixed}));
  const before=JSON.stringify(a.state), draft=a.blankCompanyBasicDraft(a.company);
  assert.equal(draft.baseSalary,30000);
  assert.equal(draft.nightAllowance,2000);
  assert.deepEqual(plain(a.companyBasicFixedEarnings(draft)),plain(a.normalizeFixedEarnings(fixed)));
  assert.equal(a.companySalaryFingerprint(a.companyBasicSalaryProfile(draft)),a.companySalaryFingerprint(a.currentCompanySalaryProfile(a.company)));
  assert.equal(JSON.stringify(a.state),before);
});

test('all five pay categories feed the same preview, payroll, leave and new overtime basis',()=>{
  const a=setup(),draft=a.blankCompanyBasicDraft(a.company);
  Object.assign(draft,{baseSalary:26600,mealAllowance:3000,positionAllowance:2000,nightAllowance:4000,fixedEarnings:[{id:'custom',name:'固定津貼',amount:7400,affectsHourly:true}]});
  a.commitCompanyBasicDraft(draft);
  const profile=a.salaryProfileAt(a.company,'2026-10-05');
  assert.deepEqual(plain(a.salaryProfileOvertimeBasis(profile)),{total:43000,divisor:240,hourlyRate:179.167});
  assert.match(a.companyBasicCalculationHtml(draft),/179\.167/);
  assert.equal(a.blankOvertime().hourlyRate,179.167);
  const record={year:2026,month:10,customEarnings:[]};
  a.applyCompanyDefaultsToRecord(record,a.company);
  assert.equal(a.recordHourlyBase(record),43000);
  assert.equal(record.customEarnings.filter(x=>x.name==='夜班津貼').length,1);
  assert.ok(record.customEarnings.every(x=>x.affectsHourly && x.sourceType==='company-fixed'));
  assert.equal(a.leaveWageDeduction({companyId:'A',startDate:'2026-10-05',hours:8,paidRatio:0}),1433);
  assert.equal(a.state.overtimeCalculator.baseSalary+a.state.overtimeCalculator.mealAllowance+a.state.overtimeCalculator.positionAllowance+a.state.overtimeCalculator.attendanceBonus+a.state.overtimeCalculator.otherFixed,43000);
});

test('sick and menstrual leave deduct half; personal and family leave deduct full wages',()=>{
  const a=setup();
  for(const [type,paidRatio,fullDay,halfDay] of [['sick',50,533,267],['menstrual',50,533,267],['personal',0,1067,533],['family',0,1067,533]]){
    assert.equal(a.LEAVE_TYPES[type].paidRatio,paidRatio);
    const record={companyId:'A',startDate:'2026-10-05',hours:8,paidRatio:a.LEAVE_TYPES[type].paidRatio};
    assert.equal(a.leaveWageDeduction(record),fullDay,type);
    assert.equal(a.leaveWageDeduction({...record,hours:4}),halfDay,type);
  }
});

test('editing protects old salaries, overtime, company base and future scheduled pay; same-day save upserts',()=>{
  const a=setup();
  a.state.records.push({id:'pay',companyId:'A',year:2026,month:9,baseSalary:26600,overtime:19665});
  a.state.overtimeLogs.push({id:'ot',companyId:'A',date:'2026-09-03',hourlyRate:179.167,hours:2,type:'weekday'});
  const future=a.normalizeSalaryAdjustment({id:'future',companyId:'A',effectiveDate:'2026-11-01',baseSalary:50000,mealAllowance:3000});
  a.state.salaryAdjustments.push(future);
  const history=JSON.stringify([a.state.records,a.state.overtimeLogs,future,a.company]);
  const draft=a.blankCompanyBasicDraft(a.company); draft.nightAllowance=5000;
  assert.equal(a.commitCompanyBasicDraft(draft),true);
  assert.equal(a.salaryProfileAt(a.company,'2026-09-30').baseSalary,26600);
  assert.equal(a.salaryProfileTotal(a.salaryProfileAt(a.company,'2026-09-30')),32000);
  assert.equal(JSON.stringify([a.state.records,a.state.overtimeLogs,future,a.company]),history);
  assert.equal(a.state.salaryAdjustments.length,2);
  draft.nightAllowance=6000; a.commitCompanyBasicDraft(draft);
  assert.equal(a.state.salaryAdjustments.length,2);
  assert.equal(a.salaryProfileTotal(a.salaryProfileAt(a.company,'2026-10-06')),37000);
  assert.equal(a.salaryProfileAt(a.company,'2026-11-01').baseSalary,50000);
});

test('no-change and name-only saves do not create pay adjustments',()=>{
  const a=setup(), draft=a.blankCompanyBasicDraft(a.company);
  a.commitCompanyBasicDraft(draft); assert.equal(a.state.salaryAdjustments.length,0);
  draft.name='Renamed'; a.commitCompanyBasicDraft(draft);
  assert.equal(a.state.companies[0].name,'Renamed'); assert.equal(a.state.salaryAdjustments.length,0);
});

test('new company persists explicit allowances; fixed earnings survive existing JSON normalizers',()=>{
  const a=setup(),draft=a.blankCompanyBasicDraft();
  assert.equal(draft.mealAllowance,3000);
  Object.assign(draft,{name:'Second',employmentStartDate:'2026-01-01',baseSalary:35000,mealAllowance:0,positionAllowance:1600,nightAllowance:2200,fixedEarnings:[{id:'extra',name:'資格津貼',amount:800}]});
  a.commitCompanyBasicDraft(draft);
  const saved=a.state.companies[1],restored=a.normalizeCompany(JSON.parse(JSON.stringify(saved)));
  assert.equal(saved.mealAllowance,0); assert.equal(saved.positionAllowance,1600);
  assert.equal(saved.fixedEarnings.filter(x=>x.name==='夜班津貼').length,1);
  assert.equal(a.salaryProfileTotal(a.companyBaseSalaryProfile(restored)),39600);
  assert.deepEqual(plain(restored),plain(saved)); assert.equal(a.state.salaryAdjustments.length,0);
});

test('hourly companies edit current hourly profiles and count fixed allowances',()=>{
  const a=setup();
  Object.assign(a.company,{employmentMode:'dispatch_hourly',baseHourlyRate:200,defaultRegularHours:160,baseSalary:32000});
  a.state.salaryAdjustments.push(a.normalizeSalaryAdjustment({id:'raise',companyId:'A',effectiveDate:'2026-09-01',employmentMode:'dispatch_hourly',baseHourlyRate:220,regularHours:160,mealAllowance:3000,positionAllowance:2000,fixedEarnings:[{id:'night',name:'夜班津貼',amount:3000}]}));
  const draft=a.blankCompanyBasicDraft(a.company);
  assert.equal(draft.baseHourlyRate,220); assert.equal(draft.defaultRegularHours,160);
  assert.equal(a.companyOvertimeRate('A','2026-09-15'),270);
  draft.baseHourlyRate=230;draft.nightAllowance=4600;a.commitCompanyBasicDraft(draft);
  assert.equal(a.companyOvertimeRate('A','2026-10-05'),290);
  assert.match(a.companyBasicFormHtml(draft,true),/name="baseHourlyRate"/);
  assert.doesNotMatch(a.companyBasicFormHtml(draft,true),/完整公司設定/);
});

test('new overtime follows selected date, while manual rates and existing logs are protected',()=>{
  const a=setup();
  a.state.salaryAdjustments.push(a.normalizeSalaryAdjustment({id:'raise',companyId:'A',effectiveDate:'2026-10-01',baseSalary:45000,mealAllowance:3000}));
  a.context.v5WorkDate=()=> '2026-09-01';
  assert.equal(a.blankOvertime().hourlyRate,133.333);
  a.ui.overtimeDraft=a.blankOvertime();a.ui.overtimeRateManual=false;
  const form=a.formFor(a.ui.overtimeDraft),rate={value:'133.333'};
  // FormData reads the mutable form inputs, like a normal submit.
  const baseGet=form.fields.get.bind(form.fields);form.fields.get=key=>key==='hourlyRate'?rate.value:baseGet(key);
  a.elements.set('#overtimeForm',form);a.elements.set('#overtimeForm [name="hourlyRate"]',rate);
  form.fields.set('date','2026-10-06');a.updateOvertimePreview('date');assert.equal(rate.value,'200.000');
  rate.value='210.123';a.updateOvertimePreview('hourlyRate');form.fields.set('date','2026-09-06');a.updateOvertimePreview('date');assert.equal(a.ui.overtimeDraft.hourlyRate,210.123);
  a.state.overtimeLogs.push(plain(a.ui.overtimeDraft));a.ui.overtimeRateManual=false;
  form.fields.set('date','2026-10-06');a.updateOvertimePreview('date');assert.equal(a.ui.overtimeDraft.hourlyRate,210.123);
  a.useCompanyOvertimeRate();assert.equal(a.ui.overtimeDraft.hourlyRate,200);
  assert.equal(a.state.overtimeLogs[0].hourlyRate,210.123);
});

test('form collection preserves custom identity, validates names and rejects negative allowances',()=>{
  const a=setup();a.ui.companyDraft=a.blankCompanyBasicDraft(a.company);
  const form=a.formFor(a.ui.companyDraft);a.elements.set('#companyBasicForm',form);
  form.fields.set('nightAllowance','7777');form.fields.set('basicFixed_0_amount','888');
  const collected=a.collectCompanyBasicDraft();assert.equal(collected.nightAllowance,7777);assert.equal(collected.fixedEarnings[0].id,'attendance');assert.equal(collected.fixedEarnings[0].amount,888);
  form.fields.set('basicFixed_0_name','');a.saveCompanyBasicForm();assert.equal(a.errors.at(-1).field,'basicFixed_0_name');assert.equal(a.state.salaryAdjustments.length,0);
  form.fields.set('basicFixed_0_name','Test');form.fields.set('nightAllowance','-1');a.saveCompanyBasicForm();assert.equal(a.errors.at(-1).field,'nightAllowance');assert.equal(a.state.salaryAdjustments.length,0);
  form.fields.set('nightAllowance','1000');a.saveCompanyBasicForm();assert.equal(a.state.salaryAdjustments.length,1);
});

test('unified form has all fields, escapes user text and has English labels without altering canonical data',()=>{
  const a=setup(),draft=a.blankCompanyBasicDraft(a.company);draft.name='<img src=x>';draft.fixedEarnings[0].name='" onfocus="alert(1)';
  const html=a.companyBasicFormHtml(draft,true);
  for(const key of ['baseSalary','mealAllowance','positionAllowance','nightAllowance','basicFixed_0_name','basicFixed_0_amount'])assert.ok(html.includes(`name="${key}"`));
  assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&quot; onfocus=&quot;'));
  assert.equal((html.match(/id="companyBasicCalculation"/g)||[]).length,1);
  const catalog={};vm.runInNewContext(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/i18n-en.js',import.meta.url),'utf8'),catalog);
  for(const text of ['薪資計算','職務津貼','夜班津貼','公司預設加班時薪','自定義固定項目','帶入公司基準'])assert.ok(catalog.SalaryMateEnglish[text]);
  assert.match(source,/const SCHEMA_VERSION = 15/);assert.match(source,/salarymate_v5_full_state/);
});

test('custom company earnings and deductions save together; only earnings change hourly pay',()=>{
  const a=setup();a.state.records.push({id:'old',companyId:'A',baseSalary:26600,customDeductions:[{id:'manual',name:'先前扣款',amount:80}]});
  const old=JSON.stringify(a.state.records);a.openDefaultDeductionRule(a.company);
  a.ui.payItemsDraft.fixedEarnings.push({id:'transport',name:'交通津貼',amount:400});
  a.ui.payItemsDraft.fixedDeductions.push({id:'welfare',name:'福利金',amount:300},{id:'dorm',name:'宿舍費',amount:1500});
  a.ui.payItemsDraft.laborIns=1200;a.ui.payItemsDraft.healthIns=800;
  a.ruleFormFor(a.ui.payItemsDraft);a.saveDefaultDeductionRule();
  assert.equal(a.errors.length,0);assert.equal(a.state.salaryAdjustments.length,1);assert.equal(a.company.fixedDeductions.length,2);
  assert.equal(a.salaryProfileTotal(a.currentCompanySalaryProfile(a.company)),32400);
  assert.equal(a.companyOvertimeRate('A','2026-10-05'),135);
  const record={year:2026,month:10,customEarnings:[],customDeductions:[]};a.applyCompanyDefaultsToRecord(record,a.company);
  assert.equal(a.deductions(record),3800);assert.equal(a.mainNet(record),28600);assert.equal(a.recordHourlyBase(record),32400);
  assert.ok(record.customDeductions.every(x=>x.sourceType==='company-fixed-deduction'&&!x.affectsHourly));
  assert.equal(JSON.stringify(a.state.records),old);
  const restored=a.normalizeCompany(plain(a.company)),restoredRecord=a.normalizeRecord(plain(record));
  assert.deepEqual(plain(restored.fixedDeductions),plain(a.company.fixedDeductions));
  assert.deepEqual(plain(restoredRecord.customDeductions),plain(record.customDeductions));
  assert.equal(a.normalizeCompany({id:'legacy',name:'Old backup'}).fixedDeductions.length,0);
});

test('reapplying defaults replaces linked deductions once and retains manual and leave deductions',()=>{
  const a=setup();a.company.fixedDeductions=[{id:'welfare',name:'福利金',amount:300},{id:'dorm',name:'宿舍費',amount:1500}];
  const manual={id:'once',name:'單次扣款',amount:200},leave={id:'leave',name:'請假扣薪',amount:500,sourceType:'leave-payroll',sourceKey:'leave:A:2026-10'};
  const record={year:2026,month:10,customDeductions:[manual,leave]};
  a.applyCompanyDefaultsToRecord(record,a.company);a.applyCompanyDefaultsToRecord(record,a.company);
  assert.equal(record.customDeductions.length,4);assert.equal(a.deductions(record),2500);
  assert.equal(record.customDeductions.filter(x=>x.sourceKey==='welfare').length,1);
  const before=JSON.stringify(record);a.company.fixedDeductions[0].amount=350;
  assert.equal(JSON.stringify(record),before);
  a.applyCompanyDefaultsToRecord(record,a.company);assert.equal(a.deductions(record),2550);
  const other=a.normalizeCompany({id:'B',name:'Other'});a.applyCompanyDefaultsToRecord(record,other);
  assert.equal(record.customDeductions.length,2);assert.equal(a.deductions(record),700);
});

test('clearing company deductions removes future defaults without removing saved payroll deductions',()=>{
  const a=setup();a.company.fixedDeductions=[{id:'d',name:'宿舍費',amount:1500}];
  const saved={year:2026,month:10};a.applyCompanyDefaultsToRecord(saved,a.company);a.state.records.push(saved);
  a.openDefaultDeductionRule(a.company);a.ui.payItemsDraft.fixedDeductions=[];
  a.ruleFormFor(a.ui.payItemsDraft);a.saveDefaultDeductionRule();
  assert.equal(a.company.fixedDeductions.length,0);assert.equal(a.state.salaryAdjustments.length,0);
  assert.equal(a.state.records[0].customDeductions[0].amount,1500);
  const next={year:2026,month:11};a.applyCompanyDefaultsToRecord(next,a.company);assert.equal(next.customDeductions.length,0);
});

test('custom rule validation prevents partial saves and preserves names, zero values and IDs',()=>{
  const a=setup();a.openDefaultDeductionRule(a.company);
  a.ui.payItemsDraft.fixedDeductions=[{id:'bad',name:'',amount:500}];
  const before=JSON.stringify(a.state),form=a.ruleFormFor(a.ui.payItemsDraft);
  a.saveDefaultDeductionRule();assert.equal(a.errors.at(-1).field,'ruleDeduction_0_name');assert.equal(JSON.stringify(a.state),before);
  form.fields.set('ruleDeduction_0_name','福利金');form.fields.set('ruleDeduction_0_amount','-10');
  a.saveDefaultDeductionRule();assert.equal(a.errors.at(-1).field,'ruleDeduction_0_amount');assert.equal(JSON.stringify(a.state),before);
  form.fields.set('ruleDeduction_0_amount','0');a.saveDefaultDeductionRule();
  assert.equal(a.company.fixedDeductions[0].id,'bad');assert.equal(a.company.fixedDeductions[0].name,'福利金');assert.equal(a.company.fixedDeductions[0].amount,0);
  assert.equal(a.state.salaryAdjustments.length,0);
});

test('copy month keeps only company fixed deductions and does not copy one-time or leave charges',()=>{
  const scope={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/copy-month.js',import.meta.url),'utf8'),scope);
  const source={id:'old',companyId:'A',year:2026,month:9,customDeductions:[{id:'fixed',name:'宿舍費',amount:1500,sourceType:'company-fixed-deduction',sourceKey:'dorm'},{id:'once',name:'一次性',amount:200},{id:'leave',name:'請假',amount:500,sourceType:'leave-payroll'}]};
  const before=JSON.stringify(source),plan=scope.window.SalaryMateCopyMonth.plan([source],'A',2026,10);
  assert.equal(plan.error,undefined);assert.equal(plan.draft.customDeductions.length,1);assert.equal(plan.draft.customDeductions[0].amount,1500);
  assert.deepEqual(plain(plan.rows.filter(x=>x.label.startsWith('扣項：')).map(x=>[x.after,x.kept])),[[1500,true],[0,false],[0,false]]);
  assert.equal(JSON.stringify(source),before);
});

test('creating payroll from leave sync also retains company fixed deductions for the chosen month',()=>{
  const a=setup();a.company.fixedDeductions=[{id:'dorm',name:'宿舍費',amount:1500}];
  a.state.salaryAdjustments.push(a.normalizeSalaryAdjustment({id:'raise',companyId:'A',effectiveDate:'2026-11-01',baseSalary:50000,mealAllowance:3000}));
  a.ui.leaveMonth=11;a.ui.companyFilter='A';
  a.context.leaveSyncInfo=()=>({total:500,wage:500,attendance:0,sourceKey:'leave:A:2026-11'});
  let draft;a.context.openRecordForm=value=>{draft=value;};
  a.syncLeaveToRecord();assert.equal(draft.month,11);assert.equal(draft.baseSalary,50000);
  assert.equal(draft.customDeductions.length,2);assert.equal(a.deductions(draft),2000);
  assert.equal(draft.customDeductions.filter(x=>x.sourceType==='leave-payroll').length,1);
  assert.equal(a.state.records.length,0);
});
