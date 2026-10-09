import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

export function ornateSelector(selector){
 // Only remove selectors with a positive, mandatory scope at their start.
 // Mixed :is()/negated/shared selectors remain in the common stylesheet.
 return /^(?:html|body)\[data-interface-style=["']?(?:pixel|macaron|autumn|doodle|cream|dusk|pencil|studio)["']?\]/.test(selector.trim())
   || /^(?:html|body)\[data-interface-style\]\[data-(?:visual-family=reference|style-variant=ornate)\]/.test(selector.trim())
   || /^(?:html|body)\[data-style-variant=["']?ornate["']?\]/.test(selector.trim())
   || /^\.(?:v5-companion|jingyu-)[\w-]*(?:[\s.:#\[]|$)/.test(selector.trim());
}
export async function buildStylePacks(base){
 const source=await readFile(path.join(base,'styles.css'),'utf8'),core=postcss.parse(source);
 core.walkRules(rule=>{if(postcss.list.comma(rule.selector).every(ornateSelector))rule.remove();});
 // Browsing the picker is not selecting a style. Keep its lightweight frames,
 // but do not fetch full scene images merely to draw unselected thumbnails.
 core.walkRules(rule=>{if(rule.selector.includes('data-preview-style='))rule.walkDecls(decl=>{if(decl.value.includes('-scene'))decl.remove();});});
 await writeFile(path.join(base,'styles-core.css'),core.toString());
 const bootstrap=await readFile(path.join(base,'bootstrap.js'),'utf8'),marker=bootstrap.indexOf('// R70:');
 if(marker<0)throw Error('Missing flight module boundary');
 // A timed-out script can still arrive; avoid reinstalling its event handlers.
 const flight='if(!window.SalaryMateCompanion){\n'+bootstrap.slice(marker)+'\n}\n';
 await writeFile(path.join(base,'ornate-flight.js'),flight);
 return {cssFull:Buffer.byteLength(source),cssCore:Buffer.byteLength(core.toString()),flight:Buffer.byteLength(flight)};
}
export async function websiteBootstrap(base){
 const full=await readFile(path.join(base,'bootstrap.js'),'utf8'),marker=full.indexOf('// R70:');
 if(marker<0)throw Error('Missing flight module boundary');
 const app=await readFile(path.join(base,'app.js'),'utf8'),version=app.match(/const APP_VERSION = '([^']+)'/)?.[1];
 if(!version)throw Error('Missing version');
 const loader=(await readFile(new URL('./style-pack-runtime.js',import.meta.url),'utf8')).replace('__SALARYMATE_VERSION__',version);
 return full.slice(0,marker)+loader;
}
