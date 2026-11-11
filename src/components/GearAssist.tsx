import { useEditor } from '../store/editor';
import { isGear, radiusOf } from '../model/types';
export function GearAssist(){
  const project=useEditor(s=>s.project),selected=useEditor(s=>s.selected);
  const gears=project.parts.filter(p=>selected.includes(p.id)&&isGear(p));
  if(!gears.length||selected.length>2||(selected.length===2&&gears.length!==2))return null;
  const chosen=gears[0],near=gears[1]??project.parts.filter(p=>isGear(p)&&p.id!==chosen.id).sort((b,c)=>Math.abs(Math.hypot(chosen.x-b.x,chosen.y-b.y)-radiusOf(chosen)-radiusOf(b))-Math.abs(Math.hypot(chosen.x-c.x,chosen.y-c.y)-radiusOf(chosen)-radiusOf(c)))[0];
  if(!near)return <div className="gear-assist"><strong>기어 맞물림 도우미</strong><p>다른 기어를 가까이 가져오면 피치 원에 자동으로 스냅됩니다.</p></div>;
  const [a,b]=gears.length===1?[near,chosen]:[chosen,near];
  const target=radiusOf(a)+radiusOf(b),d=Math.hypot(a.x-b.x,a.y-b.y),gap=d-target,same=Math.abs(a.module-b.module)<1e-5,ready=same&&Math.abs(gap)<=Math.max(.025,target*.015);
  const linked=project.connections.some(c=>c.kind==='gear'&&c.enabled&&((c.a===a.id&&c.b===b.id)||(c.a===b.id&&c.b===a.id)));
  return <div className={`gear-assist ${ready?'ready':''}`}><strong>기어 맞물림 도우미 <span>{ready?'✓ 위치 정상':'위치 조정 필요'}</span></strong><p>{a.name} ↔ {b.name}</p><div><span>현재 중심거리</span><code>{d.toFixed(3)} m</code></div><div><span>필요 중심거리</span><code>{target.toFixed(3)} m</code></div><p>{!same?'모듈이 다릅니다. 버튼을 누르면 두 번째 기어의 모듈도 맞춥니다.':ready?'점선 피치 원이 접하면 맞물릴 수 있습니다.':`${Math.abs(gap*1000).toFixed(0)} mm ${gap>0?'떨어져 있습니다. 더 가까이 옮기세요.':'겹쳤습니다. 조금 멀리 옮기세요.'}`}</p><button className="primary full" disabled={ready&&linked} onClick={()=>useEditor.getState().fitGears(a.id,b.id)}>{ready&&linked?'맞물림 연결됨':same?'위치 맞추고 연결':'모듈·위치 맞추고 연결'}</button><small>첫 번째 기어는 유지하고 두 번째 기어를 이동합니다.</small></div>;
}
