(() => {
  'use strict';
  const fields = [['baseSalary','本薪／底薪'],['mealAllowance','伙食津貼'],['positionAllowance','職務加給'],['overtime','加班費'],['bonus','獎金／紅利'],['laborIns','勞保'],['healthIns','健保'],['taxWithheld','預扣所得稅'],['otherDeduction','其他預設扣除'],['pensionSelf','勞退自提']];
  const cents = n => Math.round(Number(n || 0) * 100);
  function rows(record) {
    const list = fields.map(([key,label]) => ({key,label,expected:cents(record[key])/100}));
    for (const [kind,label] of [['customEarnings','加項'],['customDeductions','扣項']]) {
      (record[kind] || []).forEach((item,index) => list.push({key:`${kind}:${index}:${item.id || ''}`,label:`${label}：${item.name || '未命名'}`,expected:cents(item.amount)/100}));
    }
    const sum = kind => (record[kind] || []).reduce((n,item) => n+cents(item.amount),0);
    const gross = fields.slice(0,5).reduce((n,[key])=>n+cents(record[key]),0)+sum('customEarnings');
    const deductions = fields.slice(5).reduce((n,[key])=>n+cents(record[key]),0)+sum('customDeductions');
    return [...list,{key:'gross',label:'應發合計',expected:gross/100},{key:'deductions',label:'扣除合計（含自提）',expected:deductions/100},{key:'net',label:'薪資實領（不含副業）',expected:(gross-deductions)/100}];
  }
  function normalize(value) {
    if (!value || typeof value !== 'object') return null;
    const actual = Object.create(null);
    for (const [key,n] of Object.entries(value.actual || {})) {
      if (typeof n === 'number' && Number.isFinite(n) && Math.abs(n)<=1e10) actual[key]=cents(n)/100;
    }
    return {actual,reason:String(value.reason || '').slice(0,500),fingerprint:String(value.fingerprint || '').slice(0,200000),reviewed:value.reviewed === true,savedAt:String(value.savedAt || '').slice(0,40)};
  }
  const fingerprint = (record,source) => JSON.stringify([record.id,record.companyId,record.year,record.month,record.payDate,rows(record),source]);
  function evaluate(record,source,value=record.reconciliation) {
    const saved=normalize(value), list=rows(record);
    const compared=list.map(row=>({...row,actual:saved?.actual[row.key]??null,delta:saved?.actual[row.key] == null?null:(cents(saved.actual[row.key])-cents(row.expected))/100}));
    const complete=compared.every(row=>row.actual!==null);
    const different=compared.some(row=>row.delta!==null && row.delta!==0);
    const stale=!!saved && saved.fingerprint!==fingerprint(record,source);
    const blocked=(source.warnings || []).length>0;
    const status=!saved?'未核對':stale?'需重新核對':!complete?'待補資料':different?'有差異':blocked?'待確認來源':saved.reviewed?'已核對':'待確認';
    return {rows:compared,complete,different,stale,blocked,status,canConfirm:complete&&!different&&!blocked};
  }
  window.SalaryMateReconcile = Object.freeze({rows,normalize,fingerprint,evaluate});
})();
