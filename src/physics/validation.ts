import { type Project, type Connection, type Part, type Vec, ROTARY, LINEAR, LOGIC, radiusOf, localToWorld } from '../model/types';
export interface Issue { level: 'error' | 'warning'; message: string; connection?: string }
export function checkConnection(c: Connection, parts: Part[]): string | null {
  const a = parts.find(p => p.id === c.a), b = parts.find(p => p.id === c.b);
  if (!a || !b || a.id === b.id) return '서로 다른 두 부품을 선택하세요.';
  const d = Math.hypot(a.x-b.x,a.y-b.y), ra=radiusOf(a), rb=radiusOf(b);
  if (c.kind==='signal') {
    if (!LOGIC.has(a.kind)) return '제어 신호의 시작점은 센서 또는 논리 부품이어야 합니다.';
    if (!LOGIC.has(b.kind) && !ROTARY.has(b.kind) && !LINEAR.has(b.kind)) return '이 부품은 제어 신호를 받을 수 없습니다.';
    return null;
  }
  if (LOGIC.has(a.kind)||LOGIC.has(b.kind)) return '논리 부품은 제어 신호로 연결하세요.';
  if (['gear','belt','crossed','shaft','clutch'].includes(c.kind)) {
    if (!ROTARY.has(a.kind)||!ROTARY.has(b.kind)) return '회전 가능한 두 부품이 필요합니다.';
    if (c.kind==='gear') {
      if (!['gear','ratchet'].includes(a.kind)||!['gear','ratchet'].includes(b.kind)) return '톱니가 있는 두 기어를 선택하세요.';
      if (Math.abs(a.module-b.module)>1e-5) return '기어 모듈이 다릅니다. 모듈을 동일하게 설정하세요.';
      if (Math.abs(d-ra-rb) > Math.max(.025, (ra+rb)*.015)) return `중심거리 ${d.toFixed(3)} m · 필요 거리 ${(ra+rb).toFixed(3)} m`;
    }
    if (['shaft','clutch'].includes(c.kind)&&d>.04) return '동축 부품의 중심을 같은 위치에 배치하세요.';
    if (['belt','crossed'].includes(c.kind)&&d<=ra+rb+.03) return '벨트 풀리는 반지름 합보다 멀리 배치하세요.';
  }
  if (c.kind==='rack') {
    const gear=ROTARY.has(a.kind)?a:b, rack=LINEAR.has(b.kind)?b:a;
    if (gear===rack || rack.kind!=='rack' || gear.kind!=='gear') return '평기어와 랙 기어가 필요합니다.';
    if(Math.abs(gear.module-rack.module)>1e-5) return '랙과 피니언의 모듈이 다릅니다.';
    const dx=gear.x-rack.x,dy=gear.y-rack.y;
    const along=dx*Math.cos(rack.angle)+dy*Math.sin(rack.angle);
    const across=-dx*Math.sin(rack.angle)+dy*Math.cos(rack.angle);
    if(Math.abs(Math.abs(across)-radiusOf(gear)-rack.height/2)>.04 || Math.abs(along)>rack.width/2) return '피니언의 피치 원을 랙의 톱니 면에 맞춰 배치하세요.';
  }
  if(c.kind==='hinge') {
    const pa=localToWorld(a,c.portA),pb=localToWorld(b,c.portB);
    if(Math.hypot(pa.x-pb.x,pa.y-pb.y)>.08) return '힌지 연결점이 떨어져 있습니다. 연결점을 스냅하여 겹쳐 주세요.';
  }
  return null;
}
export function validateMechanism(p: Project): Issue[] {
  const issues:Issue[]=[];
  const graph=new Map<string,{id:string;ratio:number;connection:string}[]>();
  for(const c of p.connections.filter(c=>c.enabled)) {
    const error=checkConnection(c,p.parts);
    if(error) { issues.push({level:'error',message:error,connection:c.id}); continue; }
    if(!['gear','shaft'].includes(c.kind)) continue;
    const a=p.parts.find(p=>p.id===c.a)!,b=p.parts.find(p=>p.id===c.b)!;
    const ratio=c.kind==='gear'?-radiusOf(a)/radiusOf(b):1;
    graph.set(a.id,[...(graph.get(a.id)??[]),{id:b.id,ratio,connection:c.id}]);
    graph.set(b.id,[...(graph.get(b.id)??[]),{id:a.id,ratio:1/ratio,connection:c.id}]);
  }
  const ratios=new Map<string,number>();
  for(const root of graph.keys()) {
    if(ratios.has(root))continue;
    ratios.set(root,1);const queue=[root];
    while(queue.length){const id=queue.shift()!; for(const edge of graph.get(id)??[]){const v=ratios.get(id)!*edge.ratio;
      if(ratios.has(edge.id)){if(Math.abs(ratios.get(edge.id)!-v)>1e-5*Math.max(1,Math.abs(v)))issues.push({level:'error',message:'서로 모순되는 기어 회로입니다. 기어비 또는 회전 방향을 확인하세요.',connection:edge.connection});}
      else{ratios.set(edge.id,v);queue.push(edge.id);}
    }}
  }
  return issues;
}
export function nearestPort(p: Part, v: Vec, ports: Vec[]): Vec {
  return ports.reduce((best,port)=>{const w=localToWorld(p,port),b=localToWorld(p,best);return Math.hypot(w.x-v.x,w.y-v.y)<Math.hypot(b.x-v.x,b.y-v.y)?port:best;},ports[0]);
}
