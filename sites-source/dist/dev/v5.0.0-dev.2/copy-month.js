(() => {
  'use strict';
  const previous = (year, month) => month === 1 ? {year:year-1,month:12} : {year,month:month-1};
  const next = (year, month) => month === 12 ? {year:year+1,month:1} : {year,month:month+1};
  const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fields = [['baseSalary','本薪',true],['mealAllowance','伙食津貼',true],['positionAllowance','職務加給',true],['overtime','加班費',false],['bonus','獎金／紅利',false],['laborIns','勞保自負額',true],['healthIns','健保自負額',true],['taxWithheld','預扣所得稅',false],['otherDeduction','其他扣除',false],['pensionSelf','勞退自提',true],['sideIncome','副業收入',false]];
  const plan = (records,companyId,year,month) => {
    if (!companyId || !Number.isInteger(year) || year<2000 || year>2100 || !Number.isInteger(month) || month<1 || month>12) return {error:'請選擇有效的目標月份。'};
    const p=previous(year,month);
    const existing=records.filter(r=>r.companyId===companyId && Number(r.year)===year && Number(r.month)===month);
    if(existing.length) return {error:'目標月份已有薪資紀錄，請查看既有紀錄或選擇其他月份；不會覆蓋。'};
    const matches=records.filter(r=>r.companyId===companyId && Number(r.year)===p.year && Number(r.month)===p.month);
    if(matches.length!==1) return {error:matches.length?'上月有多筆薪資紀錄，請先整理後再複製。':`${p.year} 年 ${p.month} 月沒有薪資紀錄，請改選月份或直接新增薪資。`};
    const source=matches[0];
    const draft=JSON.parse(JSON.stringify(source));
    draft.id=''; draft.year=year; draft.month=month; draft.payDate=''; draft.reconciliation=null;
    draft.note=`複製自 ${p.year} 年 ${p.month} 月；本月變動項目請重新確認`;
    const rows=fields.map(([key,label,keep])=>{draft[key]=keep?amount(source[key]):0;return {label,before:amount(source[key]),after:draft[key],kept:keep};});
    draft.customEarnings=(source.customEarnings||[]).filter(item=>item.sourceType==='company-fixed').map(item=>({...item}));
    draft.customDeductions=(source.customDeductions||[]).filter(item=>item.sourceType==='company-fixed-deduction').map(item=>({...item}));
    for(const item of source.customEarnings||[]) rows.push({label:`加項：${item.name}`,before:amount(item.amount),after:item.sourceType==='company-fixed'?amount(item.amount):0,kept:item.sourceType==='company-fixed'});
    for(const item of source.customDeductions||[]) rows.push({label:`扣項：${item.name}`,before:amount(item.amount),after:item.sourceType==='company-fixed-deduction'?amount(item.amount):0,kept:item.sourceType==='company-fixed-deduction'});
    return {source,draft,rows,fingerprint:JSON.stringify(source)};
  };
  window.SalaryMateCopyMonth=Object.freeze({previous,next,plan});
})();
