/* Presentation-only localization. Form values and stored business data remain canonical. */
(function(root){
  'use strict';
  const KEY='salarymate_v5_language', START='\uE100', END='\uE101';
  const sourceNodes=new WeakMap(),sourceAttrs=new WeakMap();
  let preference='auto',observer,applying=false;
  try{const value=localStorage.getItem(KEY);if(['zh','en','auto'].includes(value))preference=value;}catch{}
  const systemLanguage=()=>String(navigator.languages?.[0]||navigator.language||'zh-TW').toLowerCase().startsWith('zh')?'zh':'en';
  const language=()=>preference==='auto'?systemLanguage():preference;
  const entries=Object.entries(root.SalaryMateEnglish||{}).sort((a,b)=>b[0].length-a[0].length);
  const exact=new Map(entries),phrases=entries.filter(([key])=>key.length>1);
  const segments=new Map(),userParts=/(\uE100[^\uE101]*\uE101)/g;
  let pattern;
  const phrasePattern=()=>pattern||(pattern=new RegExp(phrases.map(([key])=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g'));
  function segment(text){
    if(language()!=='en')return text;
    if(!/\p{Script=Han}/u.test(text))return text;
    if(segments.has(text))return segments.get(text);
    const trimmed=text.trim();
    const translated=exact.has(trimmed)?text.replace(trimmed,exact.get(trimmed)):text.replace(/共\s*(\d+)\s*家公司/g,'$1 companies').replace(/(\d{4})\s*對\s*(\d{4})/g,'$1 vs. $2')
      .replace(phrasePattern(),match=>' '+exact.get(match)+' ')
      .replace(/(\d+)\s*年\s*(\d+)\s*月/g,'$1 / $2').replace(/(\d+)\s*年/g,'$1')
      .replace(/(\d+)\s*月/g,'Month $1').replace(/(\d+)\s*日/g,'$1 day(s)')
      .replace(/(\d+(?:\.\d+)?)\s*筆/g,'$1 entries').replace(/(\d+)\s*項/g,'$1 items')
      .replace(/(\d+(?:\.\d+)?)\s*檔/g,'$1 instruments').replace(/(\d+)\s*家/g,'$1 companies')
      .replace(/(\d+(?:\.\d+)?)\s*天/g,'$1 days').replace(/(\d+(?:\.\d+)?)\s*股(?![\p{Script=Han}])/gu,'$1 shares')
      .replace(/(\d+(?:\.\d+)?)\s*倍/g,'$1×').replace(/(\d{4}-\d{2}-\d{2})\s*前/g,'before $1')
      .replace(/：/g,': ').replace(/；/g,'; ').replace(/，/g,', ').replace(/。/g,'. ').replace(/／/g,' / ').replace(/[ \t]{2,}/g,' ');
    // Bound transient label reuse; protected user segments bypass this cache.
    if(text.length<=512&&translated.length<=1024){if(segments.size>=512)segments.delete(segments.keys().next().value);segments.set(text,translated);}
    return translated;
  }
  function text(value){
    const source=String(value??'');
    if(!source.includes(START))return segment(source);
    return source.split(userParts).map(part=>part.startsWith(START)?part.slice(1,-1):segment(part)).join('');
  }
  const user=value=>START+String(value??'').replaceAll(START,'').replaceAll(END,'')+END;
  function applyScopes(scopes){
    if(applying)return;applying=true;observer?.disconnect();
    try{
      for(const scope of scopes){
      // Translating an option without a value would otherwise change submitted data.
      if(scope.matches?.('option:not([value])'))scope.setAttribute('value',scope.textContent);
      scope.querySelectorAll?.('option:not([value])').forEach(option=>option.setAttribute('value',option.textContent));
      const walk=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let node;
      while((node=walk.nextNode())){
        const parent=node.parentElement;
        if(!parent||parent.closest('script,style,[translate="no"],[data-language]'))continue;
        const stored=sourceNodes.get(node),source=stored&&stored.rendered===node.nodeValue?stored.source:node.nodeValue;
        const translated=parent.closest('textarea')?source.replaceAll(START,'').replaceAll(END,''):text(source);
        if(node.nodeValue!==translated)node.nodeValue=translated;
        sourceNodes.set(node,{source,rendered:translated});
      }
      const elements=[...(scope.nodeType===1?[scope]:[]),...(scope.querySelectorAll?.('*')||[])];
      for(const el of elements){
        if(el.closest('script,style,[translate="no"],[data-language]'))continue;
        let saved=sourceAttrs.get(el);if(!saved){saved={};sourceAttrs.set(el,saved);}
        for(const name of ['aria-label','title','placeholder','alt','data-label']){
          if(!el.hasAttribute(name))continue;
          const current=el.getAttribute(name),entry=saved[name],source=entry&&entry.rendered===current?entry.source:current;
          const translated=text(source);if(current!==translated)el.setAttribute(name,translated);saved[name]={source,rendered:translated};
        }
      }
      }
      document.documentElement.lang=language()==='zh'?'zh-Hant':'en';
      document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===language())));
      document.querySelectorAll('[data-language-preference]').forEach(select=>{select.value=preference;});
    }finally{applying=false;observer?.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','alt','data-label']});}
  }
  function apply(scope=document){applyScopes([scope]);}
  function applyMutations(records){
    const scopes=new Set();
    const add=node=>{const scope=node?.nodeType===1?node:node?.parentElement;if(scope&&scope.isConnected!==false)scopes.add(scope);};
    for(const record of records){
      if(record.type==='childList')record.addedNodes.forEach(add);
      else add(record.target);
    }
    // A newly rendered section covers its descendants; translate it only once.
    const roots=[...scopes].filter(scope=>{for(let parent=scope.parentElement;parent;parent=parent.parentElement)if(scopes.has(parent))return false;return true;});
    if(roots.length)applyScopes(roots);
  }
  function set(value){
    if(!['zh','en','auto'].includes(value))return;
    preference=value;try{localStorage.setItem(KEY,value);}catch{}
    apply();root.dispatchEvent(new CustomEvent('salarymate:language',{detail:{language:language(),preference}}));
  }
  function html(value){const doc=new DOMParser().parseFromString(value,'text/html');apply(doc);doc.documentElement.lang=language()==='zh'?'zh-Hant':'en';return '<!doctype html>'+doc.documentElement.outerHTML;}
  root.SalaryMateI18n={text,user,apply,set,language,preference:()=>preference,html};
  const nativeConfirm=root.confirm?.bind(root);if(nativeConfirm)root.confirm=message=>nativeConfirm(text(message));
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-language]');if(button){event.preventDefault();set(button.dataset.language);}});
  document.addEventListener('change',event=>{if(event.target.matches('[data-language-preference]'))set(event.target.value);});
  root.addEventListener('languagechange',()=>{if(preference==='auto')apply();});
  root.addEventListener('storage',event=>{if(event.key===KEY){preference=['zh','en'].includes(event.newValue)?event.newValue:'auto';apply();}});
  observer=new MutationObserver(applyMutations);
  apply();
})(globalThis);
