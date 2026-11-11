import { create } from 'zustand';
import { type Project, type Part, type Connection, type ConnectionKind, type Vec, type Tool, type UserModule, clone, uid, DEFAULT_SETTINGS, ROTARY, radiusOf } from '../model/types';
import { defaultProject } from '../model/examples';
import { type LibraryItem, makePart, makeConnection, springKit } from '../model/library';
import { extractModule, instantiateModule } from '../model/modules';
import { checkConnection } from '../physics/validation';

export type Dialog='examples'|'projects'|'help'|'module'|null;
export interface EditorState {
  project:Project;selected:string[];history:Project[];future:Project[];tool:Tool;
  connectionKind:ConnectionKind;from:{id:string;port:Vec}|null;placing:LibraryItem['kind']|null;
  camera:{x:number;y:number;scale:number};fitToken:number;dialog:Dialog;toast:string|null;
  savedAt:number;modules:UserModule[];clipboard:UserModule|null;hydrated:boolean;
  commit:(mutate:(p:Project)=>void)=>void;load:(p:Project)=>void;newProject:()=>void;
  select:(ids:string[])=>void;patchPart:(id:string,patch:Partial<Part>)=>void;
  moveParts:(positions:Map<string,Vec>)=>void;removeSelected:()=>void;rotateSelected:(delta:number)=>void;
  undo:()=>void;redo:()=>void;copy:()=>void;paste:()=>void;duplicate:()=>void;
  group:()=>void;ungroup:()=>void;align:(axis:'x'|'y')=>void;meshSelected:()=>void;
  addLibrary:(kind:LibraryItem['kind'],point:Vec)=>void;addConnection:(c:Connection)=>boolean;
  insertModule:(m:UserModule,point?:Vec)=>void;notify:(message:string)=>void;
}
const initial=defaultProject();
export const useEditor=create<EditorState>((set,get)=>({
  project:initial,selected:[initial.parts[2].id],history:[],future:[],tool:'select',connectionKind:'gear',from:null,placing:null,
  camera:{x:-.7,y:0,scale:92},fitToken:0,dialog:null,toast:null,savedAt:0,modules:[],clipboard:null,hydrated:false,
  commit(mutate){const s=get(),p=clone(s.project);mutate(p);p.modified=Date.now();set({project:p,history:[...s.history.slice(-59),s.project],future:[],savedAt:0});},
  load(p){set({project:clone(p),selected:p.parts.length?[p.parts.find(p=>p.kind==='gear')?.id??p.parts[0].id]:[],history:[],future:[],from:null,placing:null,tool:'select',fitToken:get().fitToken+1,dialog:null,savedAt:0});},
  newProject(){get().load({format:'mechanica',version:1,id:uid(),name:'새로운 기계 설계',description:'부품을 배치하고 연결하여 나만의 기계를 만들어 보세요.',parts:[],connections:[],settings:{...DEFAULT_SETTINGS},modified:Date.now()});},
  select(ids){set({selected:ids});},
  patchPart(id,patch){get().commit(p=>{const part=p.parts.find(p=>p.id===id);if(part)Object.assign(part,patch);});},
  moveParts(positions){get().commit(p=>{for(const part of p.parts){const v=positions.get(part.id);if(v){part.x=v.x;part.y=v.y;}}});},
  removeSelected(){const ids=new Set(get().selected);if(!ids.size)return;get().commit(p=>{p.parts=p.parts.filter(p=>!ids.has(p.id));p.connections=p.connections.filter(c=>!ids.has(c.a)&&!ids.has(c.b));for(const part of p.parts)if(ids.has(part.target))part.target='';});set({selected:[],from:null});},
  rotateSelected(delta){const s=get(),ids=new Set(s.selected),parts=s.project.parts.filter(p=>ids.has(p.id));if(!parts.length)return;
    const cx=parts.reduce((sum,p)=>sum+p.x,0)/parts.length,cy=parts.reduce((sum,p)=>sum+p.y,0)/parts.length;
    get().commit(p=>{for(const part of p.parts)if(ids.has(part.id)){const x=part.x-cx,y=part.y-cy;part.x=cx+x*Math.cos(delta)-y*Math.sin(delta);part.y=cy+x*Math.sin(delta)+y*Math.cos(delta);part.angle+=delta;}});},
  undo(){const s=get();if(!s.history.length)return;set({project:s.history.at(-1)!,history:s.history.slice(0,-1),future:[s.project,...s.future],selected:[],savedAt:0});},
  redo(){const s=get();if(!s.future.length)return;const next=s.future[0],ids=new Set(s.project.parts.map(p=>p.id)),added=next.parts.filter(p=>!ids.has(p.id)).map(p=>p.id);set({project:next,history:[...s.history,s.project],future:s.future.slice(1),selected:added.length?added:s.selected.filter(id=>next.parts.some(p=>p.id===id)),savedAt:0});},
  copy(){const s=get();if(!s.selected.length)return;set({clipboard:extractModule(s.project,s.selected,'복사한 부품')});get().notify(`${s.selected.length}개 부품을 복사했습니다.`);},
  paste(){const s=get();if(s.clipboard)get().insertModule(s.clipboard,{x:s.camera.x+.4,y:s.camera.y+.4});},
  duplicate(){const s=get();if(!s.selected.length)return;const selected=s.project.parts.filter(p=>s.selected.includes(p.id)),cx=selected.reduce((a,p)=>a+p.x,0)/selected.length,cy=selected.reduce((a,p)=>a+p.y,0)/selected.length;get().insertModule(extractModule(s.project,s.selected,'복제'),{x:cx+.4,y:cy+.4});},
  group(){const s=get(),id=uid();if(s.selected.length<2)return;get().commit(p=>p.parts.forEach(p=>{if(s.selected.includes(p.id))p.group=id;}));get().notify('선택한 부품을 그룹으로 묶었습니다.');},
  ungroup(){const s=get();get().commit(p=>p.parts.forEach(p=>{if(s.selected.includes(p.id))p.group='';}));},
  align(axis){const s=get(),parts=s.project.parts.filter(p=>s.selected.includes(p.id));if(parts.length<2)return;const avg=parts.reduce((sum,p)=>sum+p[axis],0)/parts.length;get().commit(p=>p.parts.forEach(part=>{if(s.selected.includes(part.id))part[axis]=avg;}));},
  meshSelected(){const s=get(),parts=s.project.parts.filter(p=>s.selected.includes(p.id));if(parts.length!==2||!parts.every(p=>ROTARY.has(p.kind))){get().notify('맞물릴 두 기어를 선택하세요.');return;}
    const[a,b]=parts,angle=Math.atan2(b.y-a.y,b.x-a.x);get().patchPart(b.id,{x:a.x+Math.cos(angle)*(radiusOf(a)+radiusOf(b)),y:a.y+Math.sin(angle)*(radiusOf(a)+radiusOf(b)),module:a.module});},
  addLibrary(kind,point){
    if(kind==='hinge-tool'||kind==='rope-tool'||kind==='clutch-tool'){set({tool:'connect',connectionKind:kind==='hinge-tool'?'hinge':kind==='rope-tool'?'rope':'clutch',placing:null,from:null});return;}
    if(get().project.parts.length>=1400){get().notify('안정적인 편집을 위해 부품 수를 줄여 주세요.');return;}
    const kit=kind==='spring-kit'||kind==='damper-kit'?springKit(point,kind==='damper-kit'):{parts:[makePart(kind,point.x,point.y)],connections:[]};
    get().commit(p=>{p.parts.push(...kit.parts);p.connections.push(...kit.connections);});set({selected:kit.parts.map(p=>p.id),placing:null});
  },
  addConnection(c){const s=get(),error=checkConnection(c,s.project.parts);if(error){get().notify(error);return false;}
    if(s.project.connections.some(x=>x.kind===c.kind&&((x.a===c.a&&x.b===c.b)||(c.kind!=='signal'&&x.a===c.b&&x.b===c.a)))){get().notify('이미 같은 연결이 있습니다.');return false;}
    get().commit(p=>p.connections.push(c));set({from:null});get().notify('물리 연결이 생성되었습니다.');return true;},
  insertModule(m,point){const s=get(),kit=instantiateModule(m,point??s.camera);if(s.project.parts.length+kit.parts.length>1500){get().notify('최대 1,500개의 부품을 지원합니다.');return;}get().commit(p=>{p.parts.push(...kit.parts);p.connections.push(...kit.connections);});set({selected:kit.parts.map(p=>p.id)});},
  notify(message){set({toast:message});},
}));
export const connectionFromSelection=(kind:ConnectionKind)=>{const s=useEditor.getState();if(s.selected.length!==2)return false;return s.addConnection(makeConnection(kind,s.selected[0],s.selected[1]));};
