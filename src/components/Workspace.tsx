import { useEffect, useRef, useState } from 'react';
import { MousePointer2, Move, Link2, Magnet, Grid3X3, Crosshair, Minus, Plus, Scan, ChevronRight, Layers3 } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useSimulation, simulationFrame } from '../store/simulation';
import { type Part, type Vec, type Tool, ROTARY, LOGIC, radiusOf, localToWorld, worldToLocal, portsOf } from '../model/types';
import { makePart, makeConnection, LIBRARY, CONNECTION_NAMES, type LibraryItem } from '../model/library';
import { nearestPort } from '../physics/validation';
import { drawPart, drawConnection, drawAnnotations, drawVector, partBounds } from './render';
type Drag={kind:'pan';start:Vec;camera:Vec}|{kind:'parts';start:Vec;positions:Map<string,Vec>;preview:Map<string,Vec>}|{kind:'box';start:Vec;end:Vec;shift:boolean}|{kind:'physical'};
export function Workspace(){
  const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const dims=useRef({width:1,height:1}),drag=useRef<Drag|null>(null),pointer=useRef<Vec>({x:0,y:0}),hover=useRef<string|null>(null);
  const [cursor,setCursor]=useState<Vec>({x:0,y:0});
  const tool=useEditor(s=>s.tool),placing=useEditor(s=>s.placing),from=useEditor(s=>s.from),connectionKind=useEditor(s=>s.connectionKind),fitToken=useEditor(s=>s.fitToken),snap=useEditor(s=>s.project.settings.snap),name=useEditor(s=>s.project.name),count=useEditor(s=>s.selected.length),mode=useSimulation(s=>s.mode),scale=useEditor(s=>s.camera.scale);
  const toWorld=(v:Vec)=>{const camera=useEditor.getState().camera;return{x:(v.x-dims.current.width/2)/camera.scale+camera.x,y:(v.y-dims.current.height/2)/camera.scale+camera.y};};
  const eventPoint=(e:{clientX:number;clientY:number})=>{const r=canvas.current!.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const posePart=(p:Part)=>({...p,...(useSimulation.getState().engine?.pose(p.id)??{})});
  const hit=(w:Vec)=>{
    const p=useEditor.getState().project.parts;
    for(let i=p.length-1;i>=0;i--){const part=posePart(p[i]),v=worldToLocal(part,w);
      if(ROTARY.has(part.kind)){if(part.kind==='conveyor'){if(Math.abs(v.x)<part.width/2&&Math.abs(v.y)<part.height/2)return p[i];}else if(Math.hypot(v.x,v.y)<radiusOf(part)+.08)return p[i];}
      else if(Math.abs(v.x)<(LOGIC.has(part.kind)?1.3:part.width)/2+.04&&Math.abs(v.y)<(LOGIC.has(part.kind)?.8:part.height)/2+.04)return p[i];
    }return null;
  };
  const fit=()=>{
    const parts=useEditor.getState().project.parts,w=dims.current.width,h=dims.current.height;
    if(!parts.length){useEditor.setState({camera:{x:0,y:0,scale:85}});return;}
    const bounds=parts.map(partBounds),minX=Math.min(...bounds.map(b=>b.x))-.65,maxX=Math.max(...bounds.map(b=>b.x+b.w))+.65,minY=Math.min(...bounds.map(b=>b.y))-.8,maxY=Math.max(...bounds.map(b=>b.y+b.h))+.85;
    useEditor.setState({camera:{x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.max(20,Math.min(115,(w-100)/(maxX-minX),(h-95)/(maxY-minY)))}});
  };
  useEffect(()=>{fit();},[fitToken]);
  useEffect(()=>{
    const el=canvas.current!,root=container.current!,ctx=el.getContext('2d')!;
    let firstResize=true;
    const resize=new ResizeObserver(entries=>{const box=entries[0].contentRect;dims.current={width:box.width,height:box.height};const dpr=Math.min(2,window.devicePixelRatio||1);el.width=Math.round(box.width*dpr);el.height=Math.round(box.height*dpr);el.style.width=`${box.width}px`;el.style.height=`${box.height}px`;if(firstResize){firstResize=false;fit();}});resize.observe(root);
    let request=0;
    function draw(now:number){
      simulationFrame(now);
      const s=useEditor.getState(),sim=useSimulation.getState(),engine=sim.engine,{width:w,height:h}=dims.current,{scale:k,x:cx,y:cy}=s.camera,dpr=Math.min(2,window.devicePixelRatio||1);
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c131b';ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(w/2-k*cx,h/2-k*cy);ctx.scale(k,k);
      const left=cx-w/2/k,right=cx+w/2/k,top=cy-h/2/k,bottom=cy+h/2/k;
      let grid=s.project.settings.gridSize;while(grid*k<15)grid*=2;while(grid*k>55)grid/=2;
      ctx.fillStyle='#5b718549';
      for(let x=Math.floor(left/grid)*grid;x<right;x+=grid)for(let y=Math.floor(top/grid)*grid;y<bottom;y+=grid){ctx.beginPath();ctx.arc(x,y,.65/k,0,Math.PI*2);ctx.fill();}
      ctx.lineWidth=1/k;ctx.strokeStyle='#52677a15';ctx.beginPath();for(let x=Math.floor(left/(grid*4))*grid*4;x<right;x+=grid*4){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}for(let y=Math.floor(top/(grid*4))*grid*4;y<bottom;y+=grid*4){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
      const preview=drag.current?.kind==='parts'?drag.current.preview:null;
      const parts=preview?s.project.parts.map(p=>({...p,...preview.get(p.id)})):s.project.parts;
      const project={...s.project,parts};
      const index=new Map(parts.map(p=>[p.id,p]));
      const visible=parts.filter(p=>{const pose=engine?.pose(p.id)??p,extent=ROTARY.has(p.kind)?radiusOf(p)+.8:Math.hypot(p.width,p.height)/2+.8;return pose.x+extent>left&&pose.x-extent<right&&pose.y+extent>top&&pose.y-extent<bottom;});
      if(s.project.settings.showConnections)for(const c of project.connections.filter(c=>['signal','spring','rope','weld'].includes(c.kind)))drawConnection(ctx,c,project,engine,k,index);
      for(const p of visible)drawPart(ctx,p,s.selected.includes(p.id),hover.current===p.id,k,engine);
      if(s.project.settings.showConnections)for(const c of project.connections.filter(c=>!['signal','spring','rope','weld'].includes(c.kind)))drawConnection(ctx,c,project,engine,k,index);
      if(s.project.settings.showLabels&&k>30)for(const p of visible)drawAnnotations(ctx,p,k,engine,s.selected.includes(p.id));
      if(s.project.settings.showVectors&&engine){
        for(const p of visible){const m=engine.metric(p.id)!;if(m.speed>.001)drawVector(ctx,m,{x:m.x+m.vx*.2,y:m.y+m.vy*.2},'#8dbfee',k);const r=engine.parts.get(p.id)!;if(r.mount){const f=r.mount.getReactionForce(120);if(f.length()>.05)drawVector(ctx,m,{x:m.x+f.x*.012,y:m.y+f.y*.012},'#e4b677',k);}if(ROTARY.has(p.kind)&&Math.abs(m.omega)>.01){const rad=radiusOf(p)*.53,dir=Math.sign(m.omega),end=dir*1.1;ctx.beginPath();ctx.arc(m.x,m.y,rad,0,end,dir<0);ctx.strokeStyle='#8ae9bd';ctx.lineWidth=1.5/k;ctx.stroke();const at={x:m.x+Math.cos(end)*rad,y:m.y+Math.sin(end)*rad};drawVector(ctx,{x:at.x+Math.sin(end)*dir*.08,y:at.y-Math.cos(end)*dir*.08},at,'#8ae9bd',k);}}
        for(const p of engine.contacts){ctx.beginPath();ctx.arc(p.x,p.y,3/k,0,Math.PI*2);ctx.fillStyle='#edb275';ctx.fill();}
      }
      if(s.tool==='connect'){
        for(const p of parts){if(hover.current!==p.id&&s.from?.id!==p.id&&!s.selected.includes(p.id))continue;for(const port of portsOf(p)){const w=localToWorld(engine?.pose(p.id)??p,port);ctx.beginPath();ctx.arc(w.x,w.y,4/k,0,Math.PI*2);ctx.fillStyle=s.from?.id===p.id?'#e2bd83':'#88e6c1';ctx.fill();ctx.strokeStyle='#122b25';ctx.lineWidth=1/k;ctx.stroke();}}
        if(s.from){const p=parts.find(p=>p.id===s.from!.id);if(p){const A=localToWorld(p,s.from.port),B=toWorld(pointer.current);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.strokeStyle=s.connectionKind==='signal'?'#b39bd9':'#80d6b4';ctx.setLineDash([5/k,5/k]);ctx.stroke();ctx.setLineDash([]);}}
      }
      if(s.placing){const kind=s.placing;if(!['spring-kit','damper-kit','hinge-tool','rope-tool','clutch-tool'].includes(kind)){const w=toWorld(pointer.current);ctx.globalAlpha=.45;drawPart(ctx,makePart(kind as Part['kind'],w.x,w.y),false,false,k,null);ctx.globalAlpha=1;}}
      if(drag.current?.kind==='box'){const {start,end}=drag.current;ctx.fillStyle='#79dcb011';ctx.strokeStyle='#79dcb0';ctx.lineWidth=1/k;ctx.fillRect(start.x,start.y,end.x-start.x,end.y-start.y);ctx.strokeRect(start.x,start.y,end.x-start.x,end.y-start.y);}
      ctx.restore();
      // A fixed screen-space axis indicator and scale ruler.
      ctx.strokeStyle='#687f91';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,h-25);ctx.lineTo(57,h-25);ctx.moveTo(24,h-25);ctx.lineTo(24,h-58);ctx.stroke();ctx.font='9px ui-monospace,monospace';ctx.fillStyle='#7e94a5';ctx.fillText('X',61,h-22);ctx.fillText('Y',21,h-64);
      const unit=k>65?1:2;ctx.beginPath();ctx.moveTo(w-32-k*unit,h-25);ctx.lineTo(w-32,h-25);ctx.moveTo(w-32-k*unit,h-29);ctx.lineTo(w-32-k*unit,h-21);ctx.moveTo(w-32,h-29);ctx.lineTo(w-32,h-21);ctx.stroke();ctx.textAlign='center';ctx.fillText(`${unit} m`,w-32-k*unit/2,h-34);ctx.textAlign='left';
      request=requestAnimationFrame(draw);
    }
    request=requestAnimationFrame(draw);
    const wheel=(e:WheelEvent)=>{e.preventDefault();const pt=eventPoint(e),before=toWorld(pt),camera=useEditor.getState().camera,next=Math.max(18,Math.min(350,camera.scale*Math.exp(-e.deltaY*.0015)));useEditor.setState({camera:{scale:next,x:before.x-(pt.x-dims.current.width/2)/next,y:before.y-(pt.y-dims.current.height/2)/next}});};
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>{cancelAnimationFrame(request);resize.disconnect();el.removeEventListener('wheel',wheel);};
  },[]);
  function down(e:React.PointerEvent<HTMLCanvasElement>){
    if(e.button===2)return;e.currentTarget.setPointerCapture(e.pointerId);
    const pt=eventPoint(e),w=toWorld(pt),s=useEditor.getState(),sim=useSimulation.getState();pointer.current=pt;
    if(s.tool==='pan'||e.button===1){drag.current={kind:'pan',start:pt,camera:{x:s.camera.x,y:s.camera.y}};return;}
    if(s.placing&&sim.mode==='design'){const grid=s.project.settings.gridSize;const point=s.project.settings.snap?{x:Math.round(w.x/grid)*grid,y:Math.round(w.y/grid)*grid}:w;s.addLibrary(s.placing,point);return;}
    const p=hit(w);
    if(s.tool==='connect'&&sim.mode==='design'){
      if(!p)return;const center=['gear','shaft','belt','crossed','rack','clutch','signal'].includes(s.connectionKind),port=center?{x:0,y:0}:nearestPort(p,w,portsOf(p));
      if(!s.from){useEditor.setState({from:{id:p.id,port},selected:[p.id]});}
      else if(s.from.id!==p.id){const c=makeConnection(s.connectionKind,s.from.id,p.id,{portA:s.from.port,portB:port});s.addConnection(c);}
      return;
    }
    if(!p){if(sim.mode==='design')drag.current={kind:'box',start:w,end:w,shift:e.shiftKey};else s.select([]);return;}
    let selected=s.selected;
    if(e.shiftKey){selected=selected.includes(p.id)?selected.filter(id=>id!==p.id):[...selected,p.id];s.select(selected);return;}
    if(!selected.includes(p.id)){selected=p.group?s.project.parts.filter(item=>item.group===p.group).map(p=>p.id):[p.id];s.select(selected);}
    if(sim.mode!=='design'){sim.engine?.startDrag(p.id,w);drag.current={kind:'physical'};return;}
    const positions=new Map(s.project.parts.filter(p=>selected.includes(p.id)).map(p=>[p.id,{x:p.x,y:p.y}]));drag.current={kind:'parts',start:w,positions,preview:new Map(positions)};
  }
  function move(e:React.PointerEvent<HTMLCanvasElement>){
    const pt=eventPoint(e),w=toWorld(pt);pointer.current=pt;setCursor(w);const d=drag.current,s=useEditor.getState();
    if(!d){hover.current=hit(w)?.id??null;return;}
    if(d.kind==='pan'){useEditor.setState({camera:{...s.camera,x:d.camera.x-(pt.x-d.start.x)/s.camera.scale,y:d.camera.y-(pt.y-d.start.y)/s.camera.scale}});}
    else if(d.kind==='box')d.end=w;
    else if(d.kind==='physical')useSimulation.getState().engine?.drag(w);
    else if(d.kind==='parts'){
      let dx=w.x-d.start.x,dy=w.y-d.start.y;const first=d.positions.values().next().value!;
      if(s.project.settings.snap&&!e.altKey){const grid=s.project.settings.gridSize;dx=Math.round((first.x+dx)/grid)*grid-first.x;dy=Math.round((first.y+dy)/grid)*grid-first.y;
        let closest=12/s.camera.scale,adjust:Vec|null=null;
        for(const[id,old]of d.positions){const p=s.project.parts.find(p=>p.id===id)!;for(const port of portsOf(p)){const a=localToWorld({...p,x:old.x+dx,y:old.y+dy},port);for(const other of s.project.parts){if(d.positions.has(other.id))continue;for(const bport of portsOf(other)){const b=localToWorld(other,bport),dist=Math.hypot(b.x-a.x,b.y-a.y);if(dist<closest){closest=dist;adjust={x:b.x-a.x,y:b.y-a.y};}}}}}
        if(adjust){dx+=adjust.x;dy+=adjust.y;}
      }
      d.preview=new Map([...d.positions].map(([id,p])=>[id,{x:p.x+dx,y:p.y+dy}]));
    }
  }
  function up(e:React.PointerEvent<HTMLCanvasElement>){
    const d=drag.current,s=useEditor.getState();drag.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(d?.kind==='physical')useSimulation.getState().engine?.endDrag();
    if(d?.kind==='parts'){const changed=[...d.preview].some(([id,p])=>Math.hypot(p.x-d.positions.get(id)!.x,p.y-d.positions.get(id)!.y)>.001);if(changed)s.moveParts(d.preview);}
    if(d?.kind==='box'){const minX=Math.min(d.start.x,d.end.x),maxX=Math.max(d.start.x,d.end.x),minY=Math.min(d.start.y,d.end.y),maxY=Math.max(d.start.y,d.end.y);const ids=s.project.parts.filter(p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY).map(p=>p.id);s.select(d.shift?[...new Set([...s.selected,...ids])]:ids);}
  }
  const setTool=(tool:Tool)=>{useEditor.setState({tool,placing:null,from:null});};
  return <div className={`workspace ${tool==='pan'?'panning':placing||tool==='connect'?'placing':''}`} ref={container}>
    <canvas ref={canvas} aria-label="기계 설계 작업 공간" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={e=>e.preventDefault()} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';}} onDrop={e=>{e.preventDefault();if(mode!=='design')return;const kind=e.dataTransfer.getData('mechanica/part') as LibraryItem['kind'];if(LIBRARY.some(i=>i.kind===kind))useEditor.getState().addLibrary(kind,toWorld(eventPoint(e)));}} />
    <div className="canvas-breadcrumb"><Layers3 size={13}/><span>{name}</span><ChevronRight size={12}/><span className="muted">작업 공간</span></div>
    <div className="canvas-badges"><span className={`mode-pill ${mode!=='design'?'live':''}`}><i/>{mode==='design'?'DESIGN':mode==='running'?'LIVE PHYSICS':'PAUSED'}</span><span className="si-badge">SI · m / kg / s</span></div>
    <div className="floating-tools" role="toolbar" aria-label="편집 도구">
      <button title="선택 (V)" aria-label="선택 도구" className={tool==='select'&&!placing?'active':''} onClick={()=>setTool('select')}><MousePointer2 size={17}/></button>
      <button title="화면 이동 (H) · 휠 클릭" aria-label="화면 이동" className={tool==='pan'?'active':''} onClick={()=>setTool('pan')}><Move size={17}/></button>
      <span className="tool-separator"/>
      <button title="연결 (C)" aria-label="연결 도구" className={tool==='connect'?'active':''} disabled={mode!=='design'} onClick={()=>setTool('connect')}><Link2 size={17}/></button>
      <span className="tool-separator"/>
      <button title="격자 스냅 (S) · Alt로 일시 해제" aria-label="격자 스냅" aria-pressed={snap} className={snap?'active-soft':''} onClick={()=>useEditor.getState().commit(p=>{p.settings.snap=!p.settings.snap;})}><Magnet size={17}/></button>
      <button title="전체 보기 (F)" aria-label="전체 보기" onClick={fit}><Scan size={17}/></button>
    </div>
    {tool==='connect'&&<div className="connection-toolbar"><Link2 size={14}/><select aria-label="연결 종류" value={connectionKind} onChange={e=>useEditor.setState({connectionKind:e.target.value as typeof connectionKind,from:null})}>{Object.entries(CONNECTION_NAMES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select><span>{from?'두 번째 부품 선택':'첫 번째 부품 선택'}</span></div>}
    {placing&&<div className="placement-hint"><Crosshair size={14}/>{LIBRARY.find(i=>i.kind===placing)?.name} · 클릭하여 배치 <kbd>Esc</kbd></div>}
    <div className="canvas-bottom"><span className="canvas-coordinate"><Crosshair size={11}/> X {cursor.x.toFixed(2)} <span>Y {cursor.y.toFixed(2)}</span></span>{count>0&&<span className="selection-badge">{count}개 선택</span>}</div>
    <div className="zoom-control"><button aria-label="축소" onClick={()=>useEditor.setState(s=>({camera:{...s.camera,scale:Math.max(18,s.camera.scale/1.2)}}))}><Minus size={13}/></button><button className="zoom-value" title="전체 보기" onClick={fit}>{Math.round(scale/85*100)}%</button><button aria-label="확대" onClick={()=>useEditor.setState(s=>({camera:{...s.camera,scale:Math.min(350,s.camera.scale*1.2)}}))}><Plus size={13}/></button></div>
    {!useEditor(s=>s.project.parts.length)&&<div className="empty-workspace"><div className="empty-grid"><Grid3X3 size={35}/></div><h2>아이디어를 기계로.</h2><p>왼쪽 라이브러리에서 부품을 가져오거나<br/>예제 기계로 실험을 시작하세요.</p><button className="primary" onClick={()=>useEditor.setState({dialog:'examples'})}>예제 기계 둘러보기 <ChevronRight size={14}/></button></div>}
  </div>;
}
