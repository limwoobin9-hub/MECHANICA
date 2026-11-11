import { create } from 'zustand';
import { MechanicaEngine, DT, type Metric } from '../physics/engine';
import { type Mode } from '../model/types';
import { useEditor } from './editor';
export type Sample=Metric&{time:number};
interface SimulationState {
  mode:Mode;engine:MechanicaEngine|null;time:number;fps:number;overloaded:boolean;metrics:Record<string,Metric>;samples:Sample[];tracking:string;
  system:{input:number;output:number;efficiency:number|null;energy:number};
  start:()=>void;pause:()=>void;stop:()=>void;step:()=>void;publish:()=>void;track:(id:string)=>void;
}
export const useSimulation=create<SimulationState>((set,get)=>({
  mode:'design',engine:null,time:0,fps:60,overloaded:false,metrics:{},samples:[],tracking:'',system:{input:0,output:0,efficiency:null,energy:0},
  start(){const s=get();try{const engine=s.engine??new MechanicaEngine(useEditor.getState().project);set({engine,mode:'running'});}catch(error){useEditor.getState().notify(error instanceof Error?error.message:'시뮬레이션을 시작할 수 없습니다.');}},
  pause(){set({mode:'paused'});},
  stop(){get().engine?.endDrag();set({engine:null,mode:'design',time:0,metrics:{},samples:[],overloaded:false,system:{input:0,output:0,efficiency:null,energy:0}});resetClock();},
  step(){try{const e=get().engine??new MechanicaEngine(useEditor.getState().project);e.step();set({engine:e,mode:'paused'});get().publish();}catch(error){useEditor.getState().notify(error instanceof Error?error.message:'물리 계산 오류');}},
  publish(){const s=get(),e=s.engine;if(!e)return;const id=s.tracking||useEditor.getState().selected[0];const metrics:Record<string,Metric>={};for(const key of e.parts.keys())metrics[key]=e.metric(key)!;
    const m=id?metrics[id]:undefined;const point=m?{...m,time:e.time}:null;
    const all=Object.values(metrics),input=all.reduce((s,m)=>s+m.inputPower,0),output=all.reduce((s,m)=>s+m.outputPower,0),energy=all.reduce((s,m)=>s+m.energy,0);
    set({time:e.time,metrics,samples:point&&point.time!==(s.samples.at(-1)?.time)?[...s.samples.slice(-599),point]:s.samples,system:{input,output,efficiency:input>1e-6?output/input:null,energy}});},
  track(id){if(id!==get().tracking)set({tracking:id,samples:[]});},
}));
let last=0,accumulator=0,lastPublish=0,frames=0,fpsStart=0;
export const resetClock=()=>{last=0;accumulator=0;lastPublish=0;};
export function simulationFrame(now:number){
  const s=useSimulation.getState();
  if(!last){last=now;fpsStart=now;}
  const elapsed=Math.min(.1,(now-last)/1000);last=now;frames++;
  if(now-fpsStart>1000){useSimulation.setState({fps:Math.round(frames*1000/(now-fpsStart))});frames=0;fpsStart=now;}
  if(s.mode!=='running'||!s.engine){accumulator=0;return;}
  accumulator+=elapsed*useEditor.getState().project.settings.speed;
  let steps=0;
  try{while(accumulator>=DT && steps<40){s.engine.step();accumulator-=DT;steps++;}}
  catch(error){useSimulation.setState({mode:'paused'});useEditor.getState().notify(error instanceof Error?error.message:'물리 계산 오류');}
  if(accumulator>DT*40){accumulator=0;useSimulation.setState({overloaded:true});}
  else if(s.overloaded&&steps<20)useSimulation.setState({overloaded:false});
  if(now-lastPublish>75){useSimulation.getState().publish();lastPublish=now;}
}
