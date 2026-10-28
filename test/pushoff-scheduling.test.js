import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,DEFAULT_SETTINGS} from '../src/engine/index.js';
import {roundRobin} from '../tools/pushoff.js';
const warriors=['A','B','C'].map(name=>({...compile('JMP 0'),name}));
const result=({seed})=>({w:seed%10,l:9-seed%10,t:1,smooth:0});
test('parallel GPU rows retain explicit pair seeds when jobs finish in reverse order',async()=>{
 for(const self of [true,false]) {
  const calls=[],pending=[];
  const gpu={backend:'gpu',match(task){calls.push([task.a.name,task.b.name,task.seed]);return new Promise(resolve=>pending.push(()=>resolve(result(task))));}};
  const options={rounds:10,seed:2026,settings:DEFAULT_SETTINGS,self};
  const actual=roundRobin(gpu,warriors,options);
  assert.deepEqual(calls,self?[['A','A',2026],['A','B',2033],['A','C',2040],['B','B',2027],['B','C',2034],['C','C',2028]]:[['A','B',2026],['A','C',2033],['B','C',2027]]);
  for(const finish of pending.reverse()) finish();
  const cpu={backend:'cpu',match:async task=>result(task)};
  assert.deepEqual(await actual,await roundRobin(cpu,warriors,options));
 }
});
