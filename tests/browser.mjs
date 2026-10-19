import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
try {({chromium}=await import('playwright'));}catch {({chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright'));}
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(path)]||'text/plain');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[],errors=[];
const dims=[[2,2,2],[3,2,2],[2,2,4],[2,4,2]],edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
// Independent mathematical oracle. Does not import application geometry.
function drawing(type,p,{dimensions=dims[p],shift=[0,0]}={}){
 const f=([x,y,z])=>type==='iso'?[56*Math.cos(Math.PI/6)*(x-y),56*(x+y)/2-56*z]:[56*x+56*y*.5*Math.cos(Math.PI/4),-56*z-56*y*.5*Math.sin(Math.PI/4)];
 const raw=(ds)=>Array.from({length:8},(_,i)=>f([i&1?ds[0]:0,i&2?ds[1]:0,i&4?ds[2]:0]));
 const canonical=raw(dims[p]);const center=[0,1].map(k=>(Math.min(...canonical.map(v=>v[k]))+Math.max(...canonical.map(v=>v[k])))/2);
 const vs=raw(dimensions).map(v=>[v[0]+420-center[0]+shift[0],v[1]+305-center[1]+shift[1]]);
 return edges.filter(e=>!e.includes(type==='iso'?0:2)).map(([a,b])=>({a:vs[a],b:vs[b]}));
}
async function select(page,type,p,mode='practice') {await page.selectOption('#projection',type);await page.selectOption('#problem',String(p));await page.selectOption('#mode',mode);}
async function draw(page,lines,touch=null){
 await page.locator('#board').evaluate(svg=>svg.scrollIntoView({block:'center'}));
 const transform=await page.locator('#board').evaluate(svg=>{const m=svg.getScreenCTM();return {a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f};});
 const screen=p=>({x:transform.a*p[0]+transform.c*p[1]+transform.e,y:transform.b*p[0]+transform.d*p[1]+transform.f});
 for(const s of lines){const a=screen(s.a),b=screen(s.b);
  if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:0}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:0}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:2});await page.mouse.up();}
 }
}
async function check(page,ok,label,pattern){await page.click('#check');const msg=await page.locator('#feedback').innerText();assert.equal(await page.locator('#feedback').getAttribute('data-ok'),String(ok),`${label}: ${msg}`);if(pattern)assert.match(msg,pattern,label);results.push({label,passed:true,feedback:msg});}
try{
 const page=await browser.newPage({viewport:{width:1280,height:1100}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const math=await page.evaluate(async()=>{const g=await import('./geometry.js');return ['iso','obl'].map(type=>[0,1,2,3].map(p=>{const m=g.model(type,p);return {type,p,vertices:m.vertices,origin:m.origin,axes:[g.project(type,1,0,0),g.project(type,0,1,0),g.project(type,0,0,1)]};})).flat();});
 for(const item of math){const {axes,type,p,vertices}=item;for(const [i,j] of [[0,1],[1,2],[2,0]])if(type==='iso')assert(Math.abs((axes[i][0]*axes[j][0]+axes[i][1]*axes[j][1])/(Math.hypot(...axes[i])*Math.hypot(...axes[j]))+0.5)<1e-10);if(type==='obl'){assert(Math.abs(Math.hypot(...axes[1])-28)<1e-10);assert(Math.abs(axes[1][0]+axes[1][1])<1e-10);assert.equal(Math.hypot(...axes[0]),56);assert.equal(Math.hypot(...axes[2]),56);}const lengths=[Math.hypot(vertices[1][0]-vertices[0][0],vertices[1][1]-vertices[0][1]),Math.hypot(vertices[2][0]-vertices[0][0],vertices[2][1]-vertices[0][1]),Math.hypot(vertices[4][0]-vertices[0][0],vertices[4][1]-vertices[0][1])];lengths.forEach((n,k)=>assert(Math.abs(n-dims[p][k]*(type==='obl'&&k===1?28:56))<1e-8));results.push({label:`math/${type}/problem-${p+1}/angles-scale-dimensions`,passed:true});}
 for(const type of ['iso','obl'])for(let p=0;p<4;p++){
  const tag=`desktop/${type}/problem-${p+1}`;
  await select(page,type,p,'learn');
  for(let s=0;s<5;s++){
   assert.equal(await page.locator('#counter').innerText(),`${s+1} / 5`);
   if(s===3)assert.equal(await page.locator('[data-layer="ink"] line[stroke-dasharray="7 5"]').count(),3);
   if(s===4){assert.equal(await page.locator('[data-layer="ink"] line').count(),9);assert.equal(await page.locator('[data-layer="overlay"] line').count(),0);assert.equal(await page.locator('[data-layer="ink"] line:not([stroke-dasharray=""])').count(),0);}
   if(s<4)await page.click('#next');
  }
  results.push({label:`${tag}/five-learning-steps`,passed:true});
  await page.selectOption('#mode','practice');assert.equal(await page.locator('[data-layer="ink"] *').count(),0);assert.equal(await page.locator('[data-layer="overlay"] *').count(),0);results.push({label:`${tag}/no-answer-leak`,passed:true});
  const correct=drawing(type,p);
  await draw(page,correct);await check(page,true,`${tag}/correct`);
  await page.click('#clear');await draw(page,[...correct].reverse().map(s=>({a:s.b,b:s.a})));await check(page,true,`${tag}/reversed-order-and-endpoints`);
  await page.click('#clear');await draw(page,drawing(type,p,{shift:type==='iso'?[-56*Math.cos(Math.PI/6),-28]:[-56,56]}));await check(page,true,`${tag}/translated`);
  await page.click('#clear');const badDims=[...dims[p]];badDims[0]+=1;await draw(page,drawing(type,p,{dimensions:badDims}));await check(page,false,`${tag}/wrong-width`,/치수/);
  await page.click('#clear');const badHeight=[...dims[p]];badHeight[2]+=1;await draw(page,drawing(type,p,{dimensions:badHeight}));await check(page,false,`${tag}/wrong-height`,/치수/);
  await page.click('#clear');const badDepth=[...dims[p]];badDepth[1]+=2;await draw(page,drawing(type,p,{dimensions:badDepth}));await check(page,false,`${tag}/wrong-depth`,/치수/);
  await page.click('#clear');await draw(page,correct);await draw(page,[correct[0]]);await check(page,false,`${tag}/duplicate`,/중복/);
  await page.click('#undo');await check(page,true,`${tag}/undo-duplicate`);
  await page.click('#clear');await draw(page,correct.slice(0,-1));await check(page,false,`${tag}/missing-edge`,/빠진/);
  // A non-axial line drawn between two valid grid points.
  const angle=structuredClone(correct);angle[angle.length-1].b=[angle.at(-1).a[0]+(type==='iso'?56*Math.sqrt(3):56),angle.at(-1).a[1]+(type==='iso'?0:56)];
  await page.click('#clear');await draw(page,angle);await check(page,false,`${tag}/wrong-angle`,/방향/);
  await page.click('#clear');await draw(page,correct.slice(0,-1));const disconnected=structuredClone(correct.at(-1));const move=type==='iso'?[56*Math.sqrt(3),0]:[112,0];disconnected.a=disconnected.a.map((n,k)=>n+move[k]);disconnected.b=disconnected.b.map((n,k)=>n+move[k]);await draw(page,[disconnected]);await check(page,false,`${tag}/disconnected`,/연결/);
  await page.click('#clear');await page.selectOption('#lineKind','aux');await draw(page,[correct[0]]);await check(page,false,`${tag}/construction-line`,/보조선/);await page.selectOption('#lineKind','solid');
  await page.click('#clear');await page.selectOption('#lineKind','hidden');await draw(page,[correct[0]]);await check(page,false,`${tag}/hidden-line-in-final`,/숨은선/);await page.selectOption('#lineKind','solid');
  await page.click('#clear');await page.click('#answer');assert.equal(await page.locator('[data-answer]').count(),9);await draw(page,[correct[0]]);assert.equal(await page.locator('[data-stroke]').count(),0);await check(page,false,`${tag}/answer-pauses-grading`,/모범 도면/);await page.click('#answer');assert.equal(await page.locator('[data-answer]').count(),0);
 }
 await select(page,'obl',3);await draw(page,drawing('obl',3));await page.screenshot({path:resolve(root,'test-results/desktop.png'),fullPage:true});
 const tablet=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1});const tp=await tablet.newPage();tp.on('pageerror',e=>errors.push(e.message));await tp.goto(url);const cdp=await tablet.newCDPSession(tp);
 for(const type of ['iso','obl'])for(let p=0;p<4;p++){
  await select(tp,type,p);await draw(tp,drawing(type,p,{shift:type==='iso'?[56*Math.cos(Math.PI/6),28]:[56,0]}),cdp);await check(tp,true,`tablet-touch/${type}/problem-${p+1}/translated`);
  assert(await tp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 }
 await tp.screenshot({path:resolve(root,'test-results/tablet.png'),fullPage:true});
 // Short landscape tablet: SVG letterboxing must not distort pointer mapping.
 await tp.setViewportSize({width:1024,height:600});await select(tp,'obl',0);await draw(tp,drawing('obl',0),cdp);await check(tp,true,'tablet-landscape/oblique/coordinate-mapping');
 await tp.setViewportSize({width:390,height:844});await select(tp,'iso',0);await draw(tp,drawing('iso',0),cdp);await check(tp,true,'phone/iso/letterbox-coordinate-mapping');assert(await tp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[],'browser console errors');
 results.push({label:'no-browser-runtime-errors',passed:true});
}catch(e){results.push({label:'FAIL',passed:false,error:e.stack});process.exitCode=1;}
finally{await mkdir(resolve(root,'test-results'),{recursive:true});await writeFile(resolve(root,'test-results/results.json'),JSON.stringify({url,date:new Date().toISOString(),results,errors},null,2));console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,last:results.at(-1)},null,2));await browser.close();server.close();}
