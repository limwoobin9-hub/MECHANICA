import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import { EXAMPLES } from '../src/model/examples';
import { parseProject, clone, uid } from '../src/model/types';
import { extractModule, instantiateModule } from '../src/model/modules';
import { makePart,makeConnection } from '../src/model/library';
import { saveProject,loadLastProject,listProjects,saveModule,listModules,readProjectFile } from '../src/store/persistence';
import { MechanicaEngine } from '../src/physics/engine';
import { useEditor } from '../src/store/editor';
import { useSimulation } from '../src/store/simulation';
describe('project validation and persistence',()=>{
  it('round-trips all ten editable examples without losing physical parameters',()=>{
    for(const example of EXAMPLES){const p=example.build();expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);}
  });
  it('rejects duplicate IDs, dangling connections and impossible numeric data',()=>{
    const p=EXAMPLES[0].build();const duplicate=clone(p);duplicate.parts.push(clone(duplicate.parts[0]));expect(()=>parseProject(duplicate)).toThrow(/중복/);
    const dangling=clone(p);dangling.connections[0].b='missing';expect(()=>parseProject(dangling)).toThrow(/대상/);
    const nan=clone(p);nan.parts[0].mass=NaN;expect(()=>parseProject(nan)).toThrow();
    const negative=clone(p);negative.parts[0].mass=-1;expect(()=>parseProject(negative)).toThrow();
    const foreign=clone(p);foreign.parts[0].target='missing';expect(()=>parseProject(foreign)).toThrow(/센서/);
  });
  it('IndexedDB reload yields the same motion and settings',async()=>{
    const p=EXAMPLES[2].build();p.settings.showVectors=true;p.settings.speed=.5;
    await saveProject(p);const restored=await loadLastProject();expect(restored).toEqual(p);
    const a=new MechanicaEngine(p),b=new MechanicaEngine(restored!);a.advance(2);b.advance(2);
    for(const part of p.parts)expect(b.pose(part.id)).toEqual(a.pose(part.id));
    expect((await listProjects()).some(project=>project.id===p.id)).toBe(true);
  });
  it('malformed file import leaves the saved design intact',async()=>{
    const p=EXAMPLES[0].build();await saveProject(p);
    await expect(readProjectFile(new File(['{"format":"invalid"}'],'bad.json'))).rejects.toThrow();
    expect((await loadLastProject())?.id).toBe(p.id);
    await expect(readProjectFile(new File(['x'.repeat(5*1024*1024+1)],'too-big.json'))).rejects.toThrow(/5 MB/);
  });
  it('stopping discards experimental forces and restores the untouched design',()=>{
    const p=EXAMPLES[2].build();useEditor.getState().load(p);const before=clone(useEditor.getState().project);
    useSimulation.getState().start();const e=useSimulation.getState().engine!;e.advance(1);e.setLive(p.parts[0].id,{rpm:900,load:100});e.impulse(p.parts[3].id,{x:5,y:0});e.advance(.2);
    expect(e.pose(p.parts[3].id)).not.toEqual({x:p.parts[3].x,y:p.parts[3].y,angle:p.parts[3].angle});
    useSimulation.getState().stop();expect(useSimulation.getState().mode).toBe('design');expect(useSimulation.getState().engine).toBeNull();expect(useEditor.getState().project).toEqual(before);
  });
  it('module instantiation remaps internal joints and retains external connection ports',async()=>{
    const p=EXAMPLES[0].build(),ids=p.parts.filter(p=>p.kind==='gear').slice(0,2).map(p=>p.id),module=extractModule(p,ids,'감속 모듈');
    expect(module.connections).toHaveLength(1);expect(module.ports.length).toBeGreaterThan(0);
    await saveModule(module);expect((await listModules()).find(m=>m.id===module.id)).toEqual(module);
    const kit=instantiateModule(module,{x:5,y:5}),newIds=new Set(kit.parts.map(p=>p.id));
    expect(kit.parts.every(p=>!ids.includes(p.id))).toBe(true);expect(newIds.has(kit.connections[0].a)).toBe(true);expect(newIds.has(kit.connections[0].b)).toBe(true);
    expect(kit.parts.reduce((n,p)=>n+p.customPorts.length,0)).toBe(module.ports.length);
    const merged={...p,id:uid(),parts:kit.parts,connections:kit.connections};expect(()=>new MechanicaEngine(merged)).not.toThrow();
  });
  it('sensor references inside a module follow the newly instantiated bodies',()=>{
    const p=EXAMPLES[0].build(),sensor=makePart('sensor',0,2,{target:p.parts[1].id});p.parts.push(sensor);const module=extractModule(p,[sensor.id,p.parts[1].id],'센서 모듈'),kit=instantiateModule(module,{x:3,y:1});
    expect(kit.parts.find(p=>p.kind==='sensor')!.target).toBe(kit.parts.find(p=>p.kind==='gear')!.id);
  });
  it('undo and redo preserve the assembly and reselect restored duplicates',()=>{
    useEditor.getState().load(EXAMPLES[0].build());const s=useEditor.getState();s.select(s.project.parts.filter(p=>p.kind==='gear').slice(0,2).map(p=>p.id));s.duplicate();
    expect(useEditor.getState().project.parts).toHaveLength(6);expect(useEditor.getState().project.connections).toHaveLength(4);
    useEditor.getState().undo();expect(useEditor.getState().project.parts).toHaveLength(4);useEditor.getState().redo();expect(useEditor.getState().selected).toHaveLength(2);expect(useEditor.getState().project.connections).toHaveLength(4);
  });
});
