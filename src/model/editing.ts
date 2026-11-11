import { type Part, type Vec, isGear, radiusOf, localToWorld, worldToLocal, ROTARY, LOGIC } from './types';
export const resizable=(p:Part)=>!LOGIC.has(p.kind)&&(!ROTARY.has(p.kind)||p.kind==='conveyor');
export const resizeHandles=(p:Part)=>[{x:-p.width/2,y:0},{x:p.width/2,y:0},{x:0,y:-p.height/2},{x:0,y:p.height/2}];
export function resizeFromEdge(p:Part,edge:number,point:Vec,grid=0):Part {
  const local=worldToLocal(p,point),horizontal=edge<2,sign=edge%2===0?-1:1,size=horizontal?p.width:p.height;
  let length=Math.max(.08,Math.min(30,sign*(horizontal?local.x:local.y)+size/2));
  if(grid)length=Math.max(.08,Math.min(30,Math.round(length/grid)*grid));
  const offset=sign*(length-size)/2,center=localToWorld(p,horizontal?{x:offset,y:0}:{x:0,y:offset});
  return {...p,...center,...(horizontal?{width:length}:{height:length})};
}
export function snapGear(p:Part,others:Part[],distance:number):{point:Vec;other:Part}|null {
  if(!isGear(p))return null;
  let best=distance,result:null|{point:Vec;other:Part}=null;
  for(const other of others){if(!isGear(other)||other.id===p.id||Math.abs(other.module-p.module)>1e-5)continue;
    const dx=p.x-other.x,dy=p.y-other.y,d=Math.hypot(dx,dy),target=radiusOf(p)+radiusOf(other),error=Math.abs(d-target);
    if(d>.01&&error<best){best=error;result={point:{x:other.x+dx/d*target,y:other.y+dy/d*target},other};}
  }return result;
}
