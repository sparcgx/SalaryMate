(() => {
  'use strict';
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  const hours = value => Number.isFinite(Number(value)) && Number(value)>=0 ? Math.round(Number(value)*100)/100 : 0;
  const normalizeCredit = row => ({id:String(row.id||''),sourceId:String(row.sourceId||''),companyId:String(row.companyId||''),hours:hours(row.hours),earnedAt:String(row.earnedAt||''),expiresAt:String(row.expiresAt||''),note:String(row.note||'').slice(0,160)});
  const normalizeSettlement = row => ({id:String(row.id||''),creditId:String(row.creditId||''),companyId:String(row.companyId||''),date:String(row.date||''),hours:hours(row.hours),amount:hours(row.amount),note:String(row.note||'').slice(0,160)});
  const normalizeLeaveLink = value => value === true || value === 'true';
  const assertCredit = (credit, logs, credits) => {
    const log=logs.find(x=>x.id===credit.sourceId && x.companyId===credit.companyId);
    if(!log || !validDate(log.date) || !validDate(credit.earnedAt) || credit.earnedAt!==log.date) return '找不到同公司的原始加班紀錄。';
    if(!validDate(credit.expiresAt) || credit.expiresAt<log.date) return '到期日不得早於加班日期。';
    if(!credit.hours || credit.hours>hours(log.hours)) return '轉換時數超過來源加班時數。';
    if(credits.some(x=>x.id!==credit.id && x.sourceId===credit.sourceId)) return '這筆加班已有補休來源，請先處理原紀錄。';
    return '';
  };
  const ledger = ({credits=[],settlements=[],leaves=[],logs=[],today}) => {
    const key=(companyId,id)=>JSON.stringify([companyId,id]);
    const sources=new Map(), sourceCounts=new Map(), creditIds=new Map(), logCounts=new Map();
    for(const log of logs){const k=key(log.companyId,log.id);sources.set(k,log);logCounts.set(k,(logCounts.get(k)||0)+1);}
    for(const credit of credits){const k=key(credit.companyId,credit.sourceId);sourceCounts.set(k,(sourceCounts.get(k)||0)+1);creditIds.set(credit.id,(creditIds.get(credit.id)||0)+1);}
    const rows=credits.map(c=>({credit:c,source:sources.get(key(c.companyId,c.sourceId)),used:0,settled:0,remaining:hours(c.hours),issues:[]}));
    const violations=[];
    for(const row of rows){
      const c=row.credit,k=key(c.companyId,c.sourceId);
      const issue=!c.id||creditIds.get(c.id)>1?'補休來源識別碼重複或遺失。':sourceCounts.get(k)>1?'同筆加班有重複的補休來源。':logCounts.get(k)>1?'原始加班識別碼重複。':assertCredit(c,row.source?[row.source]:[],[]);
      if(issue){row.issues.push(issue);violations.push(issue);}
    }
    const events=[];
    for(const leave of leaves){if(leave.type!=='compensatory'||leave.status!=='confirmed'||!normalizeLeaveLink(leave.compTimeLinked))continue;
      const entries=Array.isArray(leave.compTimeEntries)?leave.compTimeEntries:[];
      for(const entry of entries)events.push({kind:'leave',id:leave.id,date:entry.date,companyId:leave.companyId,hours:hours(entry.hours)});
    }
    const settlementIds=new Set();
    for(const settlement of settlements){
      if(!settlement.id||settlementIds.has(settlement.id)){violations.push('結算識別碼重複或遺失。');continue;}
      settlementIds.add(settlement.id);
      events.push({kind:'settlement',id:settlement.id,date:settlement.date,companyId:settlement.companyId,creditId:settlement.creditId,hours:hours(settlement.hours)});
    }
    events.sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.kind==='settlement')-Number(b.kind==='settlement')||String(a.id).localeCompare(String(b.id)));
    for(const event of events){if(!validDate(event.date)||!event.hours){violations.push(`事件 ${event.id} 日期或時數無效`);continue}
      let left=event.hours;
      const eligible=rows.filter(row=>!row.issues.length && row.credit.companyId===event.companyId && row.credit.earnedAt<=event.date && (event.kind==='settlement'?row.credit.id===event.creditId:row.credit.expiresAt>=event.date)).sort((a,b)=>a.credit.expiresAt.localeCompare(b.credit.expiresAt)||a.credit.earnedAt.localeCompare(b.credit.earnedAt)||a.credit.id.localeCompare(b.credit.id));
      for(const row of eligible){const n=Math.min(left,row.remaining);if(n<=0)continue;row.remaining=Math.round((row.remaining-n)*100)/100;row[event.kind==='leave'?'used':'settled']=Math.round((row[event.kind==='leave'?'used':'settled']+n)*100)/100;left=Math.round((left-n)*100)/100;if(!left)break}
      if(left>0) violations.push(`事件 ${event.id} 有 ${left} 小時無可用補休來源`);
    }
    const asOf=validDate(today)?today:'9999-12-31';
    const totals=rows.reduce((acc,row)=>{acc.earned+=hours(row.credit.hours);acc.used+=row.used;acc.settled+=row.settled;acc[row.issues.length?'invalid':row.credit.earnedAt>asOf?'upcoming':row.credit.expiresAt<asOf?'expired':'available']+=row.remaining;return acc},{earned:0,used:0,settled:0,expired:0,available:0,invalid:0,upcoming:0});
    for(const key in totals) totals[key]=Math.round(totals[key]*100)/100;
    return {rows,totals,violations};
  };
  window.SalaryMateCompTime=Object.freeze({validDate,hours,normalizeCredit,normalizeSettlement,normalizeLeaveLink,assertCredit,ledger});
})();
