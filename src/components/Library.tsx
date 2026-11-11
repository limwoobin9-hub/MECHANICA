import { useMemo, useState } from 'react';
import { Search, Plus, ChevronDown, Layers3, FolderOpen, Bookmark, CircleDot, PackageOpen, Trash2 } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useSimulation } from '../store/simulation';
import { LIBRARY } from '../model/library';
import { type Category } from '../model/types';
import { PartIcon } from './PartIcon';
import { removeModule } from '../store/persistence';
const categories:{id:Category;name:string}[]=[{id:'all',name:'전체'},{id:'structure',name:'구조물'},{id:'transmission',name:'동력 전달'},{id:'power',name:'구동'},{id:'control',name:'제어'}];
export function Library(){
  const [search,setSearch]=useState(''),[category,setCategory]=useState<Category>('transmission'),[tab,setTab]=useState<'parts'|'modules'>('parts'),[tree,setTree]=useState(true);
  const project=useEditor(s=>s.project),selected=useEditor(s=>s.selected),placing=useEditor(s=>s.placing),modules=useEditor(s=>s.modules),mode=useSimulation(s=>s.mode);
  const items=useMemo(()=>LIBRARY.filter(i=>(category==='all'||i.category===category)&&`${i.name} ${i.english}`.toLowerCase().includes(search.toLowerCase())),[category,search]);
  return <aside className="library-panel">
    <div className="panel-heading"><div><Layers3 size={15}/><h2>부품 라이브러리</h2></div><span className="count-pill">{LIBRARY.length}</span></div>
    <div className="library-tabs"><button className={tab==='parts'?'active':''} onClick={()=>setTab('parts')}>기본 부품</button><button className={tab==='modules'?'active':''} onClick={()=>setTab('modules')}><Bookmark size={12}/> 내 모듈{modules.length>0&&<span>{modules.length}</span>}</button></div>
    {tab==='parts'?<>
      <label className="search-field"><Search size={14}/><input aria-label="부품 검색" placeholder="부품 검색..." value={search} onChange={e=>setSearch(e.target.value)}/><kbd>/</kbd></label>
      <div className="categories">{categories.map(c=><button key={c.id} className={category===c.id?'active':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
      <div className="parts-scroll"><div className="category-label"><span>{categories.find(c=>c.id===category)?.name}</span><span>{items.length} PARTS</span></div>
        <div className="parts-grid">{items.map(item=><button key={item.kind} className={`part-card ${placing===item.kind?'chosen':''}`} title={`${item.description}\n클릭 후 작업 공간에 배치하거나 드래그하세요.`} disabled={mode!=='design'} draggable={mode==='design'} onDragStart={e=>{e.dataTransfer.setData('mechanica/part',item.kind);e.dataTransfer.effectAllowed='copy';}} onClick={()=>{if(item.kind.endsWith('-tool'))useEditor.getState().addLibrary(item.kind,{x:0,y:0});else useEditor.setState({placing:item.kind,tool:'select',from:null});}}>
          <span className={`part-illustration ${item.category}`}><PartIcon kind={item.kind}/></span><span className="part-card-name">{item.name}</span><span className="part-card-en">{item.english}</span><Plus className="part-add" size={12}/>
        </button>)}</div>
        {!items.length&&<div className="small-empty"><Search size={23}/><p>검색 결과가 없습니다.</p><button onClick={()=>{setSearch('');setCategory('all');}}>전체 부품 보기</button></div>}
        <div className="library-tip"><CircleDot size={13}/><span>부품을 드래그해 작업 공간에 놓으세요.</span></div>
      </div>
    </>:<div className="parts-scroll modules-list">
      <p className="subtle-text">선택한 부품과 연결을 재사용 가능한 모듈로 저장합니다.</p>
      <button className="secondary full" disabled={!selected.length||mode!=='design'} onClick={()=>useEditor.setState({dialog:'module'})}><Plus size={14}/> 선택 항목을 모듈로 저장</button>
      {modules.map(m=><div className="module-row" key={m.id}><button className="module-insert" disabled={mode!=='design'} onClick={()=>useEditor.getState().insertModule(m)}><PackageOpen size={21}/><span>{m.name}<small>{m.parts.length}개 부품 · {m.connections.length}개 연결</small></span><Plus size={13}/></button><button className="icon-button" aria-label={`${m.name} 모듈 삭제`} onClick={async()=>{try{await removeModule(m.id);useEditor.setState(s=>({modules:s.modules.filter(x=>x.id!==m.id)}));}catch{useEditor.getState().notify('모듈을 삭제하지 못했습니다.');}}}><Trash2 size={12}/></button></div>)}
      {!modules.length&&<div className="small-empty"><Bookmark size={26}/><p>저장한 모듈이 여기에 표시됩니다.</p></div>}
    </div>}
    <div className={`object-tree ${tree?'':'collapsed'}`}><button className="tree-heading" onClick={()=>setTree(!tree)}><ChevronDown size={13} className={tree?'':'rotate'}/><span>장면 구성</span><span className="tree-count">{project.parts.length}</span></button>
      {tree&&<div className="tree-list">{project.parts.map((p,i)=><button key={p.id} className={`tree-row ${selected.includes(p.id)?'selected':''}`} onClick={e=>{const s=useEditor.getState();s.select(e.shiftKey?[...new Set([...s.selected,p.id])]:[p.id]);}}><PartIcon kind={p.kind} size={14}/><span>{p.name}</span><small>{String(i+1).padStart(2,'0')}</small>{p.mounted&&<CircleDot size={10}/>}</button>)}{!project.parts.length&&<span className="tree-empty">아직 배치한 부품이 없습니다.</span>}</div>}
    </div>
    <button className="examples-launch" onClick={()=>useEditor.setState({dialog:'examples'})}><span className="examples-icon"><FolderOpen size={17}/></span><span>예제 기계 살펴보기<small>10개의 작동하는 메커니즘</small></span><Plus size={14}/></button>
  </aside>;
}
