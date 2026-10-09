import fs from 'node:fs';
import vm from 'node:vm';

// Native objects and source functions only: no browser, DOM emulator or network.
export const sourceSet=directory=>Object.fromEntries(['app.js','stocks.js','stocks-ui.js','i18n.js','i18n-en.js'].map(name=>[name,fs.readFileSync(new URL(name,directory),'utf8')]));
export const currentSources=()=>sourceSet(new URL('../../dist/dev/v5.0.0-dev.2/',import.meta.url));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function investmentHarness(sources,recordCount=0){
 const records=Array.from({length:recordCount},(_,i)=>({id:'income-'+i,date:`2026-${String(i%12+1).padStart(2,'0')}-01`,name:'Fixture income '+i,kind:'利息',note:'',amount:i+.125}));
 const state={investmentRecords:records,stockPortfolio:{assets:[],transactions:[],marketData:{autoRefresh:false,quoteEnabled:false}}};
 const listeners=new Map(),counts={legacyRenders:0,enhanced:0};let html='';
 const page={dataset:{stockTab:'overview'},querySelectorAll:()=>[]};
 const document={hidden:true,addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},querySelector:s=>s==='.stock-view'?page:s==='#appDialog'?{open:false,addEventListener(){}}:null};
 const context={state,ui:{selectedYear:2026},calculationCache:{stockModels:new Map()},Date,Intl,console,document,navigator:{onLine:true},clearTimeout(){},setTimeout(){throw Error('Unexpected timer');},todayIso:()=>'2026-10-09',newId:()=>'',escapeHtml:escape,escapeAttr:escape,userHtml:escape,
  v5Title(title,action,subtitle){counts.legacyRenders++;return `<h2>${title}</h2>${action}<p>${subtitle}</p>`;},v5Button:(title,action,attrs='')=>`<button data-action="${action}" ${attrs}>${title}</button>`,v5Stats:rows=>JSON.stringify(rows),
  enhanceFormAccessibility(){counts.enhanced++;},v5Clean(){},enhanceVisualHierarchy(){},SalaryMateI18n:{user:v=>v,text:v=>v,apply(){}},SalaryMateScrollbars:{refresh(){}},renderAll(){paint();}};
 context.window=context;vm.createContext(context);
 vm.runInContext(sources['stocks.js'],context);
 // Expose the private candidate selector only in this native measurement fixture.
 vm.runInContext(sources['stocks-ui.js'].replace('return {render,click,submit,','return {forecastAssets,render,click,submit,'),context);
 const app=sources['app.js'],start=app.indexOf('const investmentMoney ='),end=app.indexOf('    const openInvestment =',start);
 if(start<0||end<0)throw Error('Investment integration not found');
 vm.runInContext(app.slice(start,end)+'\nwindow.measure={stocksUI,renderV5Investment,renderInvestmentIncome,legacyInvestmentTotal};',context);
 function paint(){html=context.measure.renderV5Investment();page.dataset.stockTab=html.match(/data-stock-tab="([^"]+)"/)?.[1];return html;}
 const content={dataset:{loaded:'false'},innerHTML:''};
 const disclosure={open:false,isConnected:true,matches:s=>s==='.stock-legacy-shortcut',querySelector:s=>s==='[data-stock-legacy]'?content:null};
 return {context,state,counts,content,disclosure,paint,get html(){return html;},ui:context.measure.stocksUI,
  tab(id){context.measure.stocksUI.click({dataset:{stock:'tab',id},closest:()=>null});},
  toggle(open){disclosure.open=open;for(const fn of listeners.get('toggle')||[])fn({target:disclosure});}
 };
}

export function translationHarness(sources,preference='en'){
 const counts={constructors:0,dictionaryCompiles:0,dictionaryPasses:0};
 function CountedRegExp(pattern,flags){counts.constructors++;const result=new RegExp(pattern,flags);if(result.source.length>1000){counts.dictionaryCompiles++;result[Symbol.replace]=function(text,replacer){counts.dictionaryPasses++;return RegExp.prototype[Symbol.replace].call(this,text,replacer);};}return result;}
 const context={RegExp:CountedRegExp,navigator:{language:'zh-TW',languages:['zh-TW']},localStorage:{getItem:()=>preference,setItem(){}},document:{documentElement:{},querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),addEventListener(){}},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}disconnect(){}},addEventListener(){},dispatchEvent(){},CustomEvent:class{constructor(name,init){this.type=name;this.detail=init.detail;}}};
 context.window=context;vm.createContext(context);vm.runInContext(sources['i18n-en.js'],context);vm.runInContext(sources['i18n.js'],context);
 return {context,counts,api:context.SalaryMateI18n};
}
