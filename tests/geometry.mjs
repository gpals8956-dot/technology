import assert from 'node:assert/strict';
import {model,grade} from '../geometry.js';
let count=0;
for(const type of ['iso','obl'])for(let problem=0;problem<4;problem++){
  const m=model(type,problem);
  for(let i=0;i<30;i++){
    const shift=[-103.7+i*7.23,29.15-i*3.1];
    const strokes=[...m.visible].reverse().map(([a,b])=>({
      a:m.vertices[b].map((v,k)=>v+shift[k]),
      b:m.vertices[a].map((v,k)=>v+shift[k]),kind:'solid'
    }));
    assert.equal(grade(type,problem,strokes).ok,true,`${type}/${problem}/${i}`);
    count++;
  }
}
console.log(`${count} arbitrary-translation geometry regression checks passed`);
