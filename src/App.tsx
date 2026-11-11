import { useEffect, useMemo } from 'react';
import { Check, X, Activity, Cpu, CircleDot, AlertCircle, Link2, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Header, saveCurrent } from './components/Header';
import { Library } from './components/Library';
import { Workspace } from './components/Workspace';
import { Inspector } from './components/Inspector';
import { Scope } from './components/Scope';
import { Dialogs } from './components/Dialogs';
import { useEditor } from './store/editor';
import { useSimulation } from './store/simulation';
import { loadLastProject, saveProject, listModules } from './store/persistence';
import { validateMechanism } from './physics/validation';
export default function App(){
  const toast=useEditor(s=>s.toast),project=useEditor(s=>s.project),selected=useEditor(s=>s.selected),savedAt=useEditor(s=>s.savedAt),hydrated=useEditor(s=>s.hydrated),mode=useSimulation(s=>s.mode),fps=useSimulation(s=>s.fps),overloaded=useSimulation(s=>s.overloaded);
  const issues=useMemo(()=>validateMechanism(project),[project]),hasError=issues.some(i=>i.level==='error');
  useEffect(()=>{
    let alive=true;
    Promise.all([loadLastProject(),listModules()]).then(([p,modules])=>{if(!alive)return;if(p)useEditor.getState().load(p);useEditor.setState({modules,hydrated:true});}).catch(()=>{if(alive){useEditor.setState({hydrated:true});useEditor.getState().notify('브라우저 저장소에 접근할 수 없습니다. JSON 내보내기로 보관하세요.');}});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    const timeout=setTimeout(()=>{saveProject(project).then(()=>{if(useEditor.getState().project===project)useEditor.setState({savedAt:Date.now()});}).catch(()=>useEditor.getState().notify('자동 저장에 실패했습니다. JSON으로 내보내세요.'));},900);
    return()=>clearTimeout(timeout);
  },[project,hydrated]);
  useEffect(()=>{if(toast){const timeout=setTimeout(()=>useEditor.setState({toast:null}),5500);return()=>clearTimeout(timeout);}},[toast]);
  useEffect(()=>{useSimulation.getState().track(selected[0]??'');},[selected[0]]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;
      const s=useEditor.getState(),sim=useSimulation.getState(),mod=e.ctrlKey||e.metaKey;
      if(s.dialog)return;
      const key=e.key.toLowerCase();
      if(mod&&key==='s'){e.preventDefault();void saveCurrent();return;}
      if(key==='escape'){useEditor.setState({placing:null,from:null,tool:'select'});return;}
      if(e.code==='Space'){e.preventDefault();if(sim.mode==='running')sim.pause();else sim.start();return;}
      if(key==='f'){e.preventDefault();useEditor.setState({fitToken:s.fitToken+1});return;}
      if(key==='h'){useEditor.setState({tool:'pan',placing:null});return;}
      if(key==='v'&&!mod){useEditor.setState({tool:'select',placing:null,from:null});return;}
      if(sim.mode!=='design')return;
      if(mod&&key==='z'){e.preventDefault();if(e.shiftKey)s.redo();else s.undo();}
      else if(mod&&key==='y'){e.preventDefault();s.redo();}
      else if(mod&&key==='c'){e.preventDefault();s.copy();}
      else if(mod&&key==='v'){e.preventDefault();s.paste();}
      else if(mod&&key==='d'){e.preventDefault();s.duplicate();}
      else if(mod&&key==='g'){e.preventDefault();if(e.shiftKey)s.ungroup();else s.group();}
      else if(key==='delete'||key==='backspace'){e.preventDefault();s.removeSelected();}
      else if(key==='r')s.rotateSelected(s.project.settings.rotationSnap*Math.PI/180);
      else if(key==='c')useEditor.setState({tool:'connect',from:null,placing:null});
      else if(key==='s')s.commit(p=>{p.settings.snap=!p.settings.snap;});
      else if(key==='/'){e.preventDefault();document.querySelector<HTMLInputElement>('[aria-label="부품 검색"]')?.focus();}
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[]);
  return <div className="app-shell"><Header/><main className="main-grid"><Library/><Workspace/><Inspector/><Scope/></main><footer className="status-bar"><div><span className={`status-indicator ${mode==='running'?'running':''}`}/><span>{mode==='design'?'설계 모드':mode==='running'?'물리 시뮬레이션 실행 중':'시뮬레이션 일시정지'}</span><span className="status-divider"/><CircleDot size={11}/><span>{project.parts.length}개 부품</span><Link2 size={11}/><span>{project.connections.length}개 연결</span></div><div className="status-center">{overloaded?<><AlertCircle size={11}/><span>계산 부하 높음 · 품질 또는 배속을 낮추세요</span></>:hasError?<button className="status-error" onClick={()=>{const s=useEditor.getState(),c=s.project.connections.find(c=>c.id===issues[0].connection);if(c)s.select([c.a,c.b]);s.notify(issues[0].message);}}><AlertCircle size={11}/> 연결 확인 필요</button>:<><CheckCircle2 size={11}/><span>물리 시스템 정상</span></>}</div><div><span className="status-save">{savedAt?<><Check size={11}/> 자동 저장됨</>:<><LoaderCircle size={11}/> 저장 대기</>}</span><span className="status-divider"/><Cpu size={11}/><span>120 Hz</span><span className="fps">{fps} FPS</span></div></footer><Dialogs/>{toast&&<div className="toast" role="status"><InfoIcon/><span>{toast}</span><button aria-label="알림 닫기" onClick={()=>useEditor.setState({toast:null})}><X size={14}/></button></div>}</div>;
}
function InfoIcon(){return <span className="toast-icon"><Activity size={16}/></span>;}
