import {SCALE as S,DIMENSIONS,model,project,distance,grade} from './geometry.js';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg', svg=$('board');
let type='iso',problem=0,mode='learn',step=0,strokes=[],start=null,preview=null,answer=false,pointer=null;
function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));parent.append(n);return n;}
function line(g,a,b,kind='solid',attrs={}){return el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:(kind==='aux'||kind==='axis')?'#7e8da3':kind==='hidden'?'#59687b':'#174e91','stroke-width':(kind==='aux'||kind==='axis')?1.3:3,'stroke-dasharray':kind==='axis'?'10 4 2 4':kind==='hidden'?'7 5':'','stroke-linecap':'round',...attrs},g);}
function grid(g,origin){
 const draw=(p,v)=>line(g,[p[0]-v[0]*30,p[1]-v[1]*30],[p[0]+v[0]*30,p[1]+v[1]*30],'solid',{stroke:'#e4ebf4','stroke-width':1,'data-grid':'true'});
 if(type==='obl'){
  for(let i=-20;i<21;i++){draw([origin[0]+i*S,origin[1]],[0,S]);draw([origin[0],origin[1]+i*S],[S,0]);}
 }else{
  const u=project('iso',1,0,0),v=[0,S];
  for(let i=-24;i<=24;i++){
   draw([origin[0]+u[0]*i,origin[1]+u[1]*i],v);
   draw([origin[0],origin[1]+i*S],u);
   draw([origin[0],origin[1]+i*S],[-u[0],u[1]]);
  }
 }
}
function toPoint(e){const matrix=svg.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return [Math.max(0,Math.min(840,p.x)),Math.max(0,Math.min(610,p.y))];}
function snap(p,anchor=null){
 const o=model(type,problem).origin;
 const candidates=[];
 if(type==='iso'){
  const q=S*Math.sqrt(3)/2, i0=Math.round((p[0]-o[0])/q);
  for(let i=i0-2;i<=i0+2;i++){
   const j0=Math.round((p[1]-o[1]-i*S/2)/S);
   for(let j=j0-1;j<=j0+1;j++)candidates.push([o[0]+i*q,o[1]+i*S/2+j*S]);
  }
 }else{
  // Generic square lattice plus half-scale 45° depth offsets. This is not
  // derived from the answer: it works for every grid point and either order.
  const d=S/(2*Math.sqrt(2));
  for(let k=-8;k<=8;k++)candidates.push([
   o[0]+Math.round((p[0]-o[0]-k*d)/S)*S+k*d,
   o[1]+Math.round((p[1]-o[1]+k*d)/S)*S-k*d]);
  if(anchor){
   for(let k=-12;k<=12;k++)candidates.push([anchor[0]+k*d,anchor[1]-k*d], [anchor[0]+k*S,anchor[1]], [anchor[0],anchor[1]+k*S]);
  }
 }
 // Existing student endpoints are magnets; no answer vertices enter snapping.
 const own=strokes.flatMap(s=>[s.a,s.b]).filter(q=>distance(q,p)<12);
 if(own.length)return own.reduce((a,b)=>distance(a,p)<distance(b,p)?a:b);
 return candidates.reduce((a,b)=>distance(a,p)<distance(b,p)?a:b);
}
function feedback(msg,ok){$('feedback').textContent=msg;if(ok===undefined)delete $('feedback').dataset.ok;else $('feedback').dataset.ok=String(ok);}
function reset(){strokes=[];start=null;preview=null;pointer=null;answer=false;feedback('');$('measure').textContent='';render();}
function render(){
 svg.replaceChildren();const m=model(type,problem),vs=m.vertices;
 const bg=el('g',{'data-layer':'grid'},svg),ink=el('g',{'data-layer':'ink'},svg),overlay=el('g',{'data-layer':'overlay'},svg);grid(bg,m.origin);
 const [w,d,h]=DIMENSIONS[problem];
 $('dimensions').textContent=`가로 ${w} · 깊이 ${d} · 높이 ${h}단위 | 격자 한 칸 = 1단위`+(type==='obl'?` | 깊이선 길이 ${d/2}단위 (실제 깊이의 1/2)`:' | 세 축 동일 축척');
 $('method').textContent=type==='iso'?'등각투상도: 수직 위·오른쪽 아래 30°·왼쪽 아래 30°의 세 축은 서로 120°입니다. 각 축에 실제 치수를 같은 축척으로 표시합니다.':'사투상도(캐비닛): 정면은 실제 치수, 깊이선은 오른쪽 위 45° 방향으로 실제 길이의 1/2입니다. 격자의 대각선 한 칸 길이(√2)와 혼동하지 마세요.';
 const titles=type==='iso'?['세 축 그리기','축별 치수 표시','평행선으로 면 만들기','모서리와 숨은선 구분','최종 모서리 정리']:['실제 치수로 정면 그리기','45° 깊이 방향 설정','깊이를 1/2로 작도','뒷면과 숨은선 구분','최종 모서리 정리'];
 const instructions=type==='iso'?['한 기준점에서 위쪽 수직축과 좌우 아래 30° 축을 보조선으로 그립니다. 세 축 사이 각은 각각 120°입니다.','가로·깊이·높이를 각각 해당 축에 표시합니다. 점선이 아닌 가는 보조선으로 치수를 잡습니다.','대응하는 축에 평행한 보조선으로 꼭짓점을 찾고, 보이는 모서리는 실선으로 그립니다.','보이는 모서리는 굵은 실선, 가려진 세 모서리는 파선(숨은선)으로 구분합니다.','기준축·보조선·숨은선을 지우고 이번 연습의 최종 답안인 보이는 모서리 9개만 남깁니다.']:['정면의 가로와 높이는 실제 치수대로 정사각형 격자에 그립니다.','정면 꼭짓점에서 오른쪽 위 45° 방향으로 가는 보조선을 긋습니다.','깊이선 길이는 실제 깊이의 1/2입니다. 깊이 2단위는 선 길이 1단위, 깊이 4단위는 선 길이 2단위입니다.','깊이선 끝을 수평·수직으로 연결합니다. 보이는 선은 실선, 가려진 세 모서리는 숨은선으로 표시합니다.','기준축·보조선·숨은선을 지우고 이번 연습의 최종 답안인 보이는 모서리 9개만 남깁니다.'];
 $('heading').textContent=mode==='practice'?`직접 연습 · ${problem+1}번 문제`:`${step+1}단계 · ${titles[step]}`;
 $('counter').textContent=mode==='practice'?`${strokes.length}개 선 작도`:`${step+1} / 5`;
 $('instruction').textContent=mode==='practice'?'원하는 위치에서 보이는 모서리 9개를 실선으로 그리세요. 선 번호는 피드백과 연결됩니다. 모범 도면은 버튼을 눌렀을 때만 나타납니다.':instructions[step];
 $('legend').textContent=mode==='practice'?'격자만 제공 · 정답 꼭짓점·모서리 가이드 없음 · 드래그하여 선 작도':'실선: 보이는 모서리 · 파선: 숨은선 · 가는 일점쇄선: 기준축 · 가는 실선: 작도 보조선';
 $('prev').disabled=mode==='practice'||step===0;$('next').disabled=mode==='practice'||step===4;
 for(const id of ['lineKind','undo','clear','check'])$(id).disabled=mode!=='practice';
 $('answer').textContent=mode==='practice'?(answer?'모범 도면 닫기':'모범 도면 보기'):'최종 도면 보기';
 if(mode==='learn'){
  const drawEdges=(edges,kind='solid')=>edges.forEach(([a,b])=>line(ink,vs[a],vs[b],kind));
  if(step===4)drawEdges(m.visible);
  else if(type==='iso'){
   if(step<2){[project(type,w+.7,0,0),project(type,0,d+.7,0),project(type,0,0,h+.7)].forEach(v=>line(overlay,vs[0],[vs[0][0]+v[0],vs[0][1]+v[1]],'axis'));}
   if(step===1)[1,2,4].forEach(i=>{el('circle',{cx:vs[i][0],cy:vs[i][1],r:4,fill:'#174e91'},overlay);});
   if(step===2){drawEdges(m.visible.slice(0,6));drawEdges(m.visible.slice(6),'aux');drawEdges(m.hidden,'aux');}
   if(step===3){drawEdges(m.visible);drawEdges(m.hidden,'hidden');}
  }else{
   const front=[[0,1],[1,5],[5,4],[4,0]];drawEdges(front);
   if(step===1)[0,1,4,5].forEach(i=>line(overlay,vs[i],[vs[i][0]+(d+1)*S/(2*Math.sqrt(2)),vs[i][1]-(d+1)*S/(2*Math.sqrt(2))],'aux'));
   if(step===2){drawEdges([[1,3],[4,6],[5,7]]);drawEdges([[3,7],[6,7]],'aux');}
   if(step===3){drawEdges(m.visible.filter(([a,b])=>!front.some(([c,d])=>a===c&&b===d||a===d&&b===c)));drawEdges(m.hidden,'hidden');}
  }
  if(step===1){
   const labels=type==='iso'?[[vs[1],`가로 ${w}`],[vs[2],`깊이 ${d}`],[vs[4],`높이 ${h}`]]:[[vs[1],`가로 ${w}`],[vs[4],`높이 ${h}`]];
   labels.forEach(([p,label])=>{el('text',{x:p[0]+9,y:p[1]-10,fill:'#174e91','font-size':16},overlay).textContent=label;});
  }
 }else{
  strokes.forEach((s,i)=>{line(ink,s.a,s.b,s.kind,{'data-stroke':i+1});el('text',{x:(s.a[0]+s.b[0])/2+5,y:(s.a[1]+s.b[1])/2-5,fill:'#62758b','font-size':12,'data-number':i+1},ink).textContent=i+1;});
  if(start){el('circle',{cx:start[0],cy:start[1],r:5,fill:'#ee8b2a'},overlay);if(preview)line(overlay,start,preview,$('lineKind').value,{stroke:'#ee8b2a'});}
  if(answer)m.visible.forEach(([a,b])=>line(overlay,vs[a],vs[b],'solid',{stroke:'#159a6c','stroke-dasharray':'7 4','data-answer':'true'}));
 }
}
svg.addEventListener('pointerdown',e=>{
 if(mode!=='practice'||answer||pointer!==null||e.button!==0)return;
 e.preventDefault();pointer=e.pointerId;start=snap(toPoint(e));preview=start;svg.setPointerCapture(pointer);feedback('');render();
});
svg.addEventListener('pointermove',e=>{if(!start||pointer!==e.pointerId)return;preview=snap(toPoint(e),start);$('measure').textContent='도면'+` 선 길이 ${(distance(start,preview)/S).toFixed(2)}단위`+(type==='obl'?' · 깊이선이면 실제 깊이 = 이 길이 × 2':'');render();});
svg.addEventListener('pointerup',e=>{
 if(!start||pointer!==e.pointerId)return;const end=snap(toPoint(e),start);
 if(distance(start,end)>1){strokes.push({a:[...start],b:[...end],kind:$('lineKind').value});feedback(`${strokes.length}개 선을 그렸어요.`);}
 start=null;preview=null;pointer=null;render();
});
function cancel(){start=null;preview=null;pointer=null;render();}
svg.addEventListener('pointercancel',cancel);svg.addEventListener('lostpointercapture',()=>{if(start)cancel();});
$('projection').onchange=e=>{type=e.target.value;step=0;reset();};$('problem').onchange=e=>{problem=+e.target.value;step=0;reset();};$('mode').onchange=e=>{mode=e.target.value;step=0;reset();};
$('prev').onclick=()=>{step=Math.max(0,step-1);render();};$('next').onclick=()=>{step=Math.min(4,step+1);render();};
$('undo').onclick=()=>{strokes.pop();answer=false;feedback('마지막 선을 취소했어요.');render();};$('clear').onclick=reset;
$('check').onclick=()=>{if(mode!=='practice')return;if(answer){feedback('모범 도면을 닫은 뒤 자신의 도면을 검사하세요.',false);return;}const result=grade(type,problem,strokes);feedback(result.msg,result.ok);};
$('answer').onclick=()=>{if(mode==='learn')step=4;else{answer=!answer;feedback(answer?'모범 도면 확인 중에는 작도·채점을 잠시 멈춥니다. 닫으면 이어서 그릴 수 있어요.':'모범 도면을 닫았어요.');}render();};
render();
