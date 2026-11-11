import { describe,it,expect } from 'vitest';
import { makePart,makeConnection } from '../src/model/library';
import { type Project,DEFAULT_SETTINGS } from '../src/model/types';
import { MechanicaEngine } from '../src/physics/engine';
import { EXAMPLES } from '../src/model/examples';
function p(parts:Project['parts'],connections:Project['connections']=[],gravity=false):Project{return{format:'mechanica',version:1,id:'logic',name:'logic',description:'',parts,connections,modified:0,settings:{...DEFAULT_SETTINGS,gravity}};}
describe('logic and physical actuators',()=>{
  it('AND / NOT / OR propagate switch signals into a real motor',()=>{
    const sw=makePart('switch',0,2,{enabled:true}),not=makePart('not',2,2),and=makePart('and',4,2),or=makePart('or',6,2),m=makePart('motor',0,0);
    const e=new MechanicaEngine(p([sw,not,and,or,m],[makeConnection('signal',sw.id,not.id),makeConnection('signal',sw.id,and.id),makeConnection('signal',not.id,and.id),makeConnection('signal',and.id,or.id),makeConnection('signal',or.id,m.id)]));
    e.advance(.2);expect(e.signals.get(not.id)).toBe(false);expect(e.signals.get(and.id)).toBe(false);expect(Math.abs(e.metric(m.id)!.rpm)).toBeLessThan(.01);
    e.setLive(not.id,{enabled:false});e.setLive(and.id,{enabled:false});
    // An independent HIGH OR input enables the motor through the same circuit.
    const p2=p([sw,or,m],[makeConnection('signal',sw.id,or.id),makeConnection('signal',or.id,m.id)]),e2=new MechanicaEngine(p2);e2.advance(.3);expect(e2.signals.get(or.id)).toBe(true);expect(e2.metric(m.id)!.rpm).toBeGreaterThan(20);
  });
  it('timer pulses and on-delay reset after input falls',()=>{
    const sw=makePart('switch',0,0),delay=makePart('delay',2,0,{period:.2}),timer=makePart('timer',4,0,{period:.4});
    const e=new MechanicaEngine(p([sw,delay,timer],[makeConnection('signal',sw.id,delay.id)]));
    e.advance(.1);expect(e.signals.get(delay.id)).toBe(false);expect(e.signals.get(timer.id)).toBe(true);
    e.advance(.15);expect(e.signals.get(delay.id)).toBe(true);expect(e.signals.get(timer.id)).toBe(false);
    e.setLive(sw.id,{enabled:false});e.advance(.03);expect(e.signals.get(delay.id)).toBe(false);
  });
  it('speed and position sensors inspect simulated state',()=>{
    const m=makePart('motor',0,0,{rpm:100}),speed=makePart('sensor',2,0,{target:m.id,sensorMode:'speed',threshold:50}),box=makePart('box',0,3,{velocity:2,damping:0}),position=makePart('sensor',2,3,{target:box.id,sensorMode:'position',threshold:.5});
    const e=new MechanicaEngine(p([m,speed,box,position]));e.advance(.6);expect(e.signals.get(speed.id)).toBe(true);expect(e.signals.get(position.id)).toBe(true);
  });
  it('contact sensor uses actual collision overlap, not a scripted trigger',()=>{
    const box=makePart('box',-2,0,{width:.3,height:.3,velocity:2,damping:0}),sensor=makePart('sensor',0,0,{target:box.id,sensorMode:'contact',threshold:.5});
    const e=new MechanicaEngine(p([box,sensor]));e.advance(.2);expect(e.signals.get(sensor.id)).toBe(false);e.advance(.6);expect(e.signals.get(sensor.id)).toBe(true);
  });
  it('linear actuator respects its force bound and accelerates a slider',()=>{
    const a=makePart('actuator',0,0,{force:2,mass:10,rpm:60,travel:10,damping:0}),e=new MechanicaEngine(p([a]));e.advance(.5);
    expect(e.metric(a.id)!.speed).toBeCloseTo(.1,2);expect(Math.abs(e.metric(a.id)!.force)).toBeLessThanOrEqual(2.00001);
  });
  it('a force source and torque source change momentum in SI units',()=>{
    const f=makePart('force',0,0,{force:4,mass:2,damping:0,travel:20}),t=makePart('torque',4,0,{force:2,mass:2,radius:1,damping:0});
    const e=new MechanicaEngine(p([f,t]));e.advance(.5);expect(e.metric(f.id)!.vx).toBeCloseTo(1,3);expect(e.metric(t.id)!.omega).toBeCloseTo(1,3);
  });
  it('brake dissipates rotational energy while ratchet blocks reverse rotation',()=>{
    const b=makePart('brake',0,0,{angularVelocity:10,maxTorque:2,damping:0}),r=makePart('ratchet',3,0,{angularVelocity:-10});const e=new MechanicaEngine(p([b,r]));const initial=e.energy();e.advance(1);expect(e.energy()).toBeLessThan(initial*.1);expect(e.metric(r.id)!.omega).toBeGreaterThanOrEqual(-1e-8);
  });
  it('rope allows slack but limits maximum separation',()=>{
    const frame=makePart('frame',0,0),box=makePart('box',0,1,{width:.3,height:.3,velocity:3}),c=makeConnection('rope',frame.id,box.id,{restLength:2}),e=new MechanicaEngine(p([frame,box],[c],true));
    e.advance(2);expect(Math.hypot(e.metric(box.id)!.x,e.metric(box.id)!.y)).toBeLessThan(2.03);
  });
  it('conveyor physically transports its cargo toward the contact sensor',()=>{
    const project=EXAMPLES[7].build(),box=project.parts.find(p=>p.kind==='box')!,e=new MechanicaEngine(project);e.advance(2);
    expect(e.metric(box.id)!.x).toBeGreaterThan(box.x+.15);expect(e.metric(box.id)!.y).toBeLessThan(1);
  });
  it('car gears and wheel contact move the chassis along the floor',()=>{
    const project=EXAMPLES[6].build(),chassis=project.parts.find(p=>p.name==='차체')!,e=new MechanicaEngine(project);e.advance(3);
    expect(Math.abs(e.metric(chassis.id)!.x-chassis.x)).toBeGreaterThan(.15);expect(Math.abs(e.metric(chassis.id)!.y)).toBeLessThan(1);
  });
  it('eccentric cam moves a follower through real contact',()=>{
    const cam=makePart('cam',0,0,{motorEnabled:true,rpm:40,maxTorque:20}),follower=makePart('follower',0,-.75,{radius:.2,mass:1,travel:3}),e=new MechanicaEngine(p([cam,follower],[],true));
    let min=0,max=-100;for(let i=0;i<480;i++){e.step();if(i>120){const y=e.metric(follower.id)!.y;min=Math.min(min,y);max=Math.max(max,y);}}
    expect(max-min).toBeGreaterThan(.15);expect(max).toBeLessThan(0);
  });
});
