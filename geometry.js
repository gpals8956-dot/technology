// All lengths are drawing units; projection scale is 56 SVG units per unit.
export const SCALE = 56;
export const DIMENSIONS = [[2,2,2],[3,2,2],[2,2,4],[2,4,2]];
export const EDGES = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function project(type,x,y,z) {
  return type === 'iso' ? [(x-y)*SCALE*Math.sqrt(3)/2,(x+y)*SCALE/2-z*SCALE]
    : [(x+y/(2*Math.sqrt(2)))*SCALE,(-z-y/(2*Math.sqrt(2)))*SCALE];
}
export function model(type,problem) {
  const [w,d,h] = DIMENSIONS[problem];
  const raw = Array.from({length:8},(_,i)=>project(type,i&1?w:0,i&2?d:0,i&4?h:0));
  const origin = [420-(Math.min(...raw.map(p=>p[0]))+Math.max(...raw.map(p=>p[0])))/2,
    305-(Math.min(...raw.map(p=>p[1]))+Math.max(...raw.map(p=>p[1])))/2];
  const vertices = raw.map(p=>[p[0]+origin[0],p[1]+origin[1]]);
  const hidden = type==='iso'?0:2;
  return {origin,vertices,visible:EDGES.filter(e=>!e.includes(hidden)),hidden:EDGES.filter(e=>e.includes(hidden))};
}
const near=(a,b)=>distance(a,b)<0.75;
const same=(a,b)=>near(a.a,b.a)&&near(a.b,b.b)||near(a.a,b.b)&&near(a.b,b.a);
export function grade(type,problem,strokes) {
  if(!strokes.length)return {ok:false,msg:'아직 선이 없어요. 보이는 모서리 9개를 실선으로 그려 보세요.'};
  const duplicates=strokes.filter((s,i)=>strokes.slice(0,i).some(t=>same(s,t))).length;
  if(duplicates)return {ok:false,msg:`중복된 선이 ${duplicates}개 있어요. 같은 모서리를 두 번 그리지 않도록 선 취소 또는 모두 지우기로 정리하세요.`};
  const auxiliary=strokes.filter(s=>s.kind!=='solid');
  if(auxiliary.length)return {ok:false,msg:`최종 도면에 숨은선·보조선이 ${auxiliary.length}개 남아 있어요. 이번 문제는 보이는 모서리 9개만 실선으로 제출합니다. 기준축과 보조선을 정리하세요.`};
  const m=model(type,problem), expected=m.visible.map(([a,b])=>({a:m.vertices[a],b:m.vertices[b]}));
  let best={count:-1,used:new Set(),matched:new Set(),shift:[0,0]};
  for(const u of strokes.flatMap(s=>[s.a,s.b]))for(const v of expected.flatMap(s=>[s.a,s.b])) {
    const shift=[u[0]-v[0],u[1]-v[1]], used=new Set(),matched=new Set();
    strokes.forEach((s,i)=>{const moved={a:s.a.map((n,k)=>n-shift[k]),b:s.b.map((n,k)=>n-shift[k])};
      const j=expected.findIndex((t,j)=>!used.has(j)&&same(moved,t));
      if(j>=0){used.add(j);matched.add(i);}
    });
    if(used.size>best.count)best={count:used.size,used,matched,shift};
  }
  if(best.count===9&&strokes.length===9)return {ok:true,msg:'정답!'+' 가로·깊이·높이, 방향과 모서리 연결이 모두 일치해요. 도면의 위치 이동도 인정했어요.'};
  const notes=[];
  if(strokes.length!==9)notes.push(`현재 ${strokes.length}개 선입니다. 보이는 모서리 9개가 필요해요.`);
  notes.push(`가장 잘 맞는 위치에서 모서리 ${best.count}/9개가 일치해요.`);
  const axes=type==='iso'?[project(type,1,0,0),project(type,0,1,0),project(type,0,0,1)]
    :[project(type,1,0,0),project(type,0,1,0),project(type,0,0,1)];
  const dimensions=DIMENSIONS[problem], names=['가로','깊이','높이'];
  const badAngles=[],badLengths=[],badConnections=[];
  strokes.forEach((s,i)=>{
    if(best.matched.has(i))return;
    const v=[s.b[0]-s.a[0],s.b[1]-s.a[1]], len=distance(s.a,s.b);
    const axis=axes.findIndex(a=>Math.abs(v[0]*a[1]-v[1]*a[0])/(Math.max(len,1)*Math.hypot(...a))<0.012);
    if(axis<0)badAngles.push(i+1);
    else if(Math.abs(len-Math.hypot(...axes[axis])*dimensions[axis])>0.75)
      badLengths.push(`${i+1}번 ${names[axis]}선: 약 ${(len/Math.hypot(...axes[axis])).toFixed(2)}단위 → ${dimensions[axis]}단위`);
    else badConnections.push(i+1);
  });
  if(badAngles.length)notes.push(`${badAngles.join(', ')}번 선의 방향을 확인하세요. ${type==='iso'?'등각 축은 수직과 좌우 30° 방향이며 세 축 사이가 120°입니다.':'정면은 수평·수직, 깊이선은 오른쪽 위 45° 방향입니다.'}`);
  if(badLengths.length)notes.push(`치수 확인: ${badLengths.join('; ')}.${type==='obl'?' 깊이선의 도면 길이는 실제 깊이의 1/2입니다.':''}`);
  if(badConnections.length)notes.push(`${badConnections.join(', ')}번 선은 길이·방향이 맞지만 연결 위치가 달라요. 이웃 모서리 끝점과 같은 꼭짓점에서 만나도록 연결하세요.`);
  if(strokes.length<9)notes.push('빠진 모서리를 추가하세요.');
  if(strokes.length>9)notes.push('불필요한 선을 지우세요.');
  return {ok:false,msg:notes.join('\n')};
}
