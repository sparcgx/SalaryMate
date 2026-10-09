import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import postcss from 'postcss';

test('R96 CSS reduction preserves every R95 rule, declaration, value and cascade order',()=>{
 const root=new URL('..',import.meta.url),path='dist/dev/v5.0.0-dev.2/styles.css';
 const old=execFileSync('git',['show','52973f806bced9c06073ea3c62409409297a180e:'+path],{cwd:root,encoding:'utf8'});
 const current=fs.readFileSync(new URL(path,root),'utf8');
 const rules=text=>{const ast=postcss.parse(text);ast.walkComments(node=>node.remove());return JSON.parse(JSON.stringify(ast.toJSON(),(key,value)=>['raws','source','inputs'].includes(key)?undefined:value));};
 assert.deepEqual(rules(current),rules(old));
 assert.ok(Buffer.byteLength(current)<280000);
 assert.ok(Buffer.byteLength(current)<Buffer.byteLength(old));
});
