import { type LibraryItem } from '../model/library';
import { Cog, Circle, Disc3, RectangleHorizontal, MoveHorizontal, Power, Timer, Radio, GitBranch, ToggleRight, Gauge, Zap, CircleDot, Link2, Cable, Hand, Square, Orbit, Workflow } from 'lucide-react';
export function PartIcon({kind,size=35}:{kind:LibraryItem['kind'];size?:number}){
  const props={size,strokeWidth:1.25};
  switch(kind){
    case 'gear':case 'ratchet':return <Cog {...props}/>;
    case 'pulley':case 'flywheel':return <Disc3 {...props}/>;
    case 'disc':return <Circle {...props}/>;
    case 'motor':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="8" y="9" width="23" height="23" rx="6"/><path d="M2 20h6m23 0h7M13 5v4m5-4v4m5-4v4m5-4v4M12 35h16"/><circle cx="19.5" cy="20.5" r="6"/><path d="m19 16-2 5h5l-2 4"/></svg>;
    case 'piston':case 'actuator':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M6 5v30h28V5M6 9h28M15 21v14m10-14v14"/><rect x="9" y="13" width="22" height="9" rx="1"/><path d="M12 16h16m-16 3h16"/></svg>;
    case 'crank':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="19" cy="21" r="14"/><circle cx="19" cy="21" r="3"/><path d="m21 19 7-7"/><circle cx="29" cy="11" r="4"/></svg>;
    case 'rod':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m11 26 15-15m-12 18 15-15"/><circle cx="10" cy="30" r="5"/><circle cx="30" cy="10" r="5"/></svg>;
    case 'spring-kit':case 'damper-kit':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 3v5l-7 3 14 4-14 4 14 4-14 4 7 3v7M12 3h16m-16 34h16"/></svg>;
    case 'rack':return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="13" r="8"/><circle cx="20" cy="13" r="2"/><path d="M3 31h34v5H3zM6 31v-5h4v5m6 0v-5h4v5m6 0v-5h4v5"/></svg>;
    case 'frame':return <RectangleHorizontal {...props}/>;
    case 'box':return <Square {...props}/>;
    case 'bearing':return <CircleDot {...props}/>;
    case 'hinge-tool':case 'clutch-tool':return <Link2 {...props}/>;
    case 'rope-tool':return <Cable {...props}/>;
    case 'force':return <MoveHorizontal {...props}/>;
    case 'torque':return <Orbit {...props}/>;
    case 'brake':return <Hand {...props}/>;
    case 'switch':return <ToggleRight {...props}/>;
    case 'button':return <Power {...props}/>;
    case 'timer':case 'delay':return <Timer {...props}/>;
    case 'sensor':return <Radio {...props}/>;
    case 'and':case 'or':case 'not':return <GitBranch {...props}/>;
    case 'controller':return <Gauge {...props}/>;
    case 'cam':return <Orbit {...props}/>;
    case 'follower':return <MoveHorizontal {...props}/>;
    case 'conveyor':return <Workflow {...props}/>;
    default:return <Zap {...props}/>;
  }
}
