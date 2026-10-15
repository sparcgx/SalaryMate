(() => {
  'use strict';
  const amount = value => Number.isFinite(Number(value)) ? Math.round(Number(value)*100)/100 : 0;
  const sum = values => amount(values.reduce((n,value)=>n+amount(value),0));
  const total = records => {
    const result={count:records.length,fixed:0,variable:0,gross:0,deductions:0,mainNet:0,side:0,combined:0};
    for(const row of records){
      const fixed=sum([row.baseSalary,row.mealAllowance,row.positionAllowance,...(row.customEarnings||[]).filter(item=>item.sourceType==='company-fixed').map(item=>item.amount)]);
      const variable=sum([row.overtime,row.bonus,...(row.customEarnings||[]).filter(item=>item.sourceType!=='company-fixed').map(item=>item.amount)]);
      const deductions=sum([row.laborIns,row.healthIns,row.taxWithheld,row.otherDeduction,row.pensionSelf,...(row.customDeductions||[]).map(item=>item.amount)]);
      result.fixed+=fixed;result.variable+=variable;result.gross+=fixed+variable;result.deductions+=deductions;result.side+=amount(row.sideIncome);
    }
    for(const key of ['fixed','variable','gross','deductions','side'])result[key]=amount(result[key]);
    result.mainNet=amount(result.gross-result.deductions);result.combined=amount(result.mainNet+result.side);
    return result;
  };
  const shares = values => {
    if(values.some(value=>value<0))return values.map(()=>null);
    const denominator=sum(values);return values.map(value=>denominator>0?value/denominator*100:null);
  };
  const analyze = (records,{year,throughMonth=12,companyId='ALL'}) => {
    year=Number(year);throughMonth=Math.max(1,Math.min(12,Math.floor(Number(throughMonth)||12)));
    const scope=records.filter(row=>companyId==='ALL'||row.companyId===companyId);
    const byYear = selected => Array.from({length:throughMonth},(_,index)=>{const month=index+1;return {month,...total(scope.filter(row=>Number(row.year)===selected&&Number(row.month)===month))}});
    const current=byYear(year),previous=byYear(year-1);
    const common=current.filter((row,index)=>row.count&&previous[index].count).map(row=>row.month);
    const inMonths=(selected,months)=>scope.filter(row=>Number(row.year)===selected&&months.includes(Number(row.month)));
    const totals=total(inMonths(year,current.map(row=>row.month))),prior=total(inMonths(year-1,current.map(row=>row.month)));
    const paired=total(inMonths(year,common)),pairedPrior=total(inMonths(year-1,common));
    const delta=common.length?amount(paired.combined-pairedPrior.combined):null;
    const growth=common.length&&pairedPrior.combined>0?delta/pairedPrior.combined*100:null;
    return {year,throughMonth,current,previous,totals,prior,paired,pairedPrior,common,delta,growth,missingCurrent:current.filter(row=>!row.count).map(row=>row.month),missingPrevious:previous.filter(row=>!row.count).map(row=>row.month),netShares:shares([totals.mainNet,totals.side]),grossShares:shares([totals.fixed,totals.variable])};
  };
  const csvCell = value => {
    let text=String(value??'');
    if(typeof value!=='number'&&/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  const csv = rows => '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  window.SalaryMateAnnual=Object.freeze({amount,total,shares,analyze,csv});
})();
