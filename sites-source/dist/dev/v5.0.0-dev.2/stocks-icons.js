(function(root){
  'use strict';
  // Original vector artwork: no remote logos, fonts, or image requests.
  const items={
    stock:{label:'成長股票',colors:['#2767cb','#173d87','#d8eeff'],art:'<path d="M16 45V32h7v13zm12 0V25h7v20zm12 0V17h7v28z" fill="currentColor" opacity=".9"/><path d="m15 25 11-9 9 3 13-10m-9 0h9v9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'},
    etf:{label:'ETF 組合',colors:['#8c64e4','#50308e','#eee3ff'],art:'<rect x="14" y="13" width="16" height="16" rx="5" fill="#fff"/><rect x="34" y="13" width="16" height="16" rx="5" fill="currentColor" opacity=".7"/><rect x="14" y="33" width="16" height="16" rx="5" fill="currentColor" opacity=".7"/><rect x="34" y="33" width="16" height="16" rx="5" fill="#fff"/><path d="m39 41 3 3 5-6" fill="none" stroke="#7652bb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'},
    fund:{label:'基金配置',colors:['#d65a8e','#8e2857','#ffdeed'],art:'<path d="m12 38 20 12 20-12-20-12z" fill="currentColor" opacity=".45"/><path d="m12 29 20 12 20-12-20-12z" fill="currentColor" opacity=".75"/><path d="m12 20 20 12 20-12-20-12z" fill="#fff"/>'},
    bond:{label:'債券防守',colors:['#20a595','#12645d','#cdfff1'],art:'<path d="m32 11 17 7v13c0 11-10 18-17 21-7-3-17-10-17-21V18z" fill="currentColor" opacity=".88"/><path d="m23 31 6 6 13-14" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'},
    dividend:{label:'股息收益',colors:['#e5a63b','#96601c','#fff1bd'],art:'<ellipse cx="29" cy="43" rx="16" ry="6" fill="currentColor"/><path d="M13 35v7c0 8 32 8 32 0v-7" fill="currentColor" opacity=".6"/><ellipse cx="29" cy="34" rx="16" ry="6" fill="#fff"/><path d="M29 26V13m-6 6 6 6 6-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="46" cy="18" r="7" fill="currentColor" opacity=".9"/>'},
    tech:{label:'科技晶片',colors:['#418dd7','#265090','#d6f4ff'],art:'<path d="M23 10v7m9-7v7m9-7v7M23 47v7m9-7v7m9-7v7M10 23h7m-7 9h7m-7 9h7m30-18h7m-7 9h7m-7 9h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="17" y="17" width="30" height="30" rx="7" fill="#fff"/><rect x="24" y="24" width="16" height="16" rx="4" fill="currentColor"/><path d="m28 32 3 3 6-7" stroke="#3978b7" stroke-width="2" fill="none"/>'},
    global:{label:'全球市場',colors:['#677bd6','#354379','#e3e9ff'],art:'<circle cx="32" cy="32" r="20" fill="currentColor" opacity=".22"/><circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="2.5"/><ellipse cx="32" cy="32" rx="9" ry="19" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M14 24h36M13 39h38M32 13v38" stroke="currentColor" stroke-width="2.5"/>'},
    insight:{label:'智慧分析',colors:['#378b83','#184f53','#d1fff0'],art:'<path d="M14 46V33m10 13V27m10 19V20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="m44 10 3.2 8.8L56 22l-8.8 3.2L44 34l-3.2-8.8L32 22l8.8-3.2z" fill="#fff"/><circle cx="47" cy="44" r="5" fill="currentColor" opacity=".65"/>'}
  };
  const presets=Object.entries(items).filter(([id])=>id!=='insight').map(([id,v])=>[id,v.label]);
  function infer(a={}){
    if(items[a.iconPreset]&&a.iconPreset!=='insight')return a.iconPreset;
    const type=a.typeOverride||a.marketInfo?.instrumentType||'',words=[a.name,a.group,a.industryOverride,a.marketInfo?.industry].join(' ');
    if(/債|bond|treasury/i.test(words))return 'bond';
    if(/股息|高息|dividend/i.test(words))return 'dividend';
    if(type==='etf'||a.market==='TW'&&/^00\d/.test(a.symbol||''))return 'etf';
    if(type==='fund')return 'fund';
    if(/半導體|科技|晶|semiconductor|technology/i.test(words))return 'tech';
    return 'stock';
  }
  function svg(key){
    const v=items[key]||items.stock,[light,dark,ink]=v.colors;
    // Layered solid fills stay sharp at 24 px and avoid repeated SVG IDs.
    return `<svg class="stock-designed-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect x="1" y="1" width="62" height="62" rx="17" fill="${dark}"/><path d="M18 1h28a17 17 0 0 1 17 17v24C39 53 15 36 1 34V18A17 17 0 0 1 18 1Z" fill="${light}"/><path d="M18 2h28a16 16 0 0 1 16 16" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><g color="${ink}">${v.art}</g></svg>`;
  }
  root.SalaryMateStockIcons=Object.freeze({presets,infer,svg});
})(globalThis);
