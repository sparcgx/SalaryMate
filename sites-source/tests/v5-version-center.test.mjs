import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/dev/v5.0.0-dev.2/release-history.js',import.meta.url),'utf8');
function history(extra={}){const c=vm.createContext(extra);vm.runInContext(source,c);return c.SalaryMateReleaseHistory;}
test('version history renders current version and ordered, dated changes without a network request',()=>{
 const h=history({fetch(){throw Error('Version history must work offline');}}),html=h.render('5.3.2');
 assert.match(html,/目前使用[\s\S]*v5\.3\.2/);assert.equal((html.match(/<details /g)||[]).length,8);assert.equal((html.match(/ open>/g)||[]).length,1);
 assert.ok(html.includes('漲跌額')&&html.includes('版本中心'));assert.ok(!html.includes('data-action="open-desktop-updates"'));
 assert.ok(h.entries.every((e,i)=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&(!i||e.date<=h.entries[i-1].date)));
 assert.ok(!h.render('<script>').includes('<script>'));
});
test('version history distinguishes desktop, offline and English channels',()=>{
 for(const [platform,label]of [['win32','Windows 桌面版'],['darwin','Mac 桌面版']]){const html=history({SalaryMateDesktop:{platform}}).render('5.3.2');assert.ok(html.includes(label)&&html.includes('data-action="open-desktop-updates"'));}
 assert.ok(history({location:{protocol:'file:'}}).render('5.3.2').includes('離線網頁版'));
 const english=history({SalaryMateI18n:{language:()=> 'en'}}).render('5.3.2');assert.ok(english.includes('Currently using')&&english.includes('Price changes and version center'));assert.ok(!english.includes('漲跌額'));
});
