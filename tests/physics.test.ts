import { describe, it, expect } from 'vitest';
import { MechanicaEngine, DT } from '../src/physics/engine';
import { EXAMPLES } from '../src/model/examples';
import { makePart, makeConnection } from '../src/model/library';
import { type Project, DEFAULT_SETTINGS, radiusOf } from '../src/model/types';
import { validateMechanism } from '../src/physics/validation';

function simple(parts:Project['parts'], connections:Project['connections']=[]):Project {
  return {format:'mechanica',version:1,id:'test',name:'test',description:'',parts,connections,settings:{...DEFAULT_SETTINGS},modified:0};
}
describe('mechanical constraint solver',()=>{
  it('transmits gear ratio and alternates rotation direction under torque',()=>{
    const p=EXAMPLES[0].build(),e=new MechanicaEngine(p);e.advance(2);
    const g=p.parts.filter(p=>p.kind==='gear'),w=g.map(g=>e.metric(g.id)!.omega);
    expect(w[0]).toBeGreaterThan(1);
    expect(w[1]/w[0]).toBeCloseTo(-.5,4);
    expect(w[2]/w[1]).toBeCloseTo(-48/36,4);
  });
  it('load changes acceleration and stalls a torque-limited motor',()=>{
    const p=EXAMPLES[0].build();p.parts[0].rpm=300;
    const free=new MechanicaEngine(p),loaded=new MechanicaEngine(p);
    const gear=p.parts.find(p=>p.kind==='gear')!;
    loaded.setLive(gear.id,{load:30});free.advance(1);loaded.advance(1);
    expect(Math.abs(loaded.metric(gear.id)!.rpm)).toBeLessThan(Math.abs(free.metric(gear.id)!.rpm)*.2);
    expect(Math.abs(loaded.metric(p.parts[0].id)!.torque)).toBeLessThanOrEqual(p.parts[0].maxTorque+1e-7);
  });
  it('reflects inertia into acceleration rather than prescribing angles',()=>{
    const p=EXAMPLES[0].build();p.parts[0].rpm=1000;
    const light=new MechanicaEngine(p);p.parts.filter(p=>p.kind==='gear').forEach(p=>p.mass*=10);
    const heavy=new MechanicaEngine(p);light.advance(.5);heavy.advance(.5);
    expect(heavy.metric(p.parts[0].id)!.omega).toBeLessThan(light.metric(p.parts[0].id)!.omega*.3);
  });
  it('rejects invalid center distance and inconsistent odd gear loops',()=>{
    const p=EXAMPLES[0].build();p.parts[2].x+=.3;
    expect(()=>new MechanicaEngine(p)).toThrow(/중심거리/);
    const a=makePart('gear',0,0),b=makePart('gear',1.2,0),c=makePart('gear',.6,Math.sqrt(1.08));
    const cycle=simple([a,b,c],[makeConnection('gear',a.id,b.id),makeConnection('gear',b.id,c.id),makeConnection('gear',c.id,a.id)]);
    expect(validateMechanism(cycle).some(i=>/모순/.test(i.message))).toBe(true);
  });
  it('crank and piston use physical hinges with bounded closure error',()=>{
    const p=EXAMPLES[2].build(),e=new MechanicaEngine(p),piston=p.parts.find(p=>p.kind==='piston')!;
    const positions:number[]=[];let closure=0;
    for(let i=0;i<960;i++){
      e.step();positions.push(e.metric(piston.id)!.x);
      for(const c of p.connections.filter(c=>c.kind==='hinge')){
        const A=e.parts.get(c.a)!.body.getWorldPoint(c.portA),B=e.parts.get(c.b)!.body.getWorldPoint(c.portB);
        closure=Math.max(closure,Math.hypot(A.x-B.x,A.y-B.y));
      }
    }
    expect(Math.max(...positions)-Math.min(...positions)).toBeGreaterThan(1);
    expect(closure).toBeLessThan(.025);
    expect(Math.abs(e.metric(piston.id)!.y)).toBeLessThan(.005);
  });
  it('piston force reacts back into the driving crank',()=>{
    const p=EXAMPLES[2].build(),piston=p.parts.find(p=>p.kind==='piston')!,m=p.parts[0];m.rpm=1000;m.maxTorque=1;
    const a=new MechanicaEngine(p),b=new MechanicaEngine(p);
    a.advance(.1);b.advance(.1);b.impulse(piston.id,{x:-8,y:0});a.advance(.04);b.advance(.04);
    expect(Math.abs(a.metric(m.id)!.rpm-b.metric(m.id)!.rpm)).toBeGreaterThan(1);
  });
  it('belt traction respects ratio and slips when friction is insufficient',()=>{
    const p=EXAMPLES[3].build(),a=p.parts.find(p=>p.kind==='pulley')!,b=p.parts.filter(p=>p.kind==='pulley')[1];
    p.connections.find(c=>c.kind==='belt')!.tension=1000;
    const ideal=new MechanicaEngine(p);ideal.advance(2);
    expect(ideal.metric(b.id)!.omega/ideal.metric(a.id)!.omega).toBeCloseTo(radiusOf(a)/radiusOf(b),2);
    p.connections.find(c=>c.kind==='belt')!.tension=.5;b.load=20;
    const slip=new MechanicaEngine(p);slip.advance(2);
    expect(slip.belts[0].slip).toBeGreaterThan(1);
    expect(slip.belts[0].torque).toBeLessThanOrEqual(.5*.5*radiusOf(a)+1e-8);
  });
  it('crossed belt reverses output and conserves passive kinetic energy',()=>{
    const a=makePart('pulley',-2,0,{angularVelocity:10,damping:0}),b=makePart('pulley',2,0,{damping:0});
    const e=new MechanicaEngine(simple([a,b],[makeConnection('crossed',a.id,b.id,{tension:1000})]));
    const initial=e.energy();e.advance(1);
    expect(e.metric(b.id)!.omega).toBeLessThan(0);
    expect(e.energy()).toBeLessThanOrEqual(initial+1e-5);
  });
  it('spring oscillates and damping dissipates energy',()=>{
    const p=EXAMPLES[4].build(),mass=p.parts.find(p=>p.kind==='box')!,e=new MechanicaEngine(p),initial=e.energy();
    let min=Infinity,max=-Infinity;
    for(let i=0;i<720;i++){e.step();const y=e.metric(mass.id)!.y;min=Math.min(min,y);max=Math.max(max,y);}
    expect(max-min).toBeGreaterThan(1);
    expect(e.energy()).toBeLessThan(initial*.8);
  });
  it('rack and pinion transfer torque to a translating mass',()=>{
    const g=makePart('gear',0,0,{motorEnabled:true,rpm:30,maxTorque:3}),r=makePart('rack',0,.725,{travel:20});
    const e=new MechanicaEngine(simple([g,r],[makeConnection('rack',g.id,r.id)]));e.advance(.5);
    expect(Math.abs(e.metric(r.id)!.vx)).toBeGreaterThan(.05);
    expect(Math.abs(e.metric(r.id)!.vx)).toBeCloseTo(Math.abs(e.metric(g.id)!.omega*radiusOf(g)),3);
  });
  it.each(EXAMPLES.map(e=>[e.name,e] as const))('%s remains finite and stable for 6 simulated seconds',(_name,example)=>{
    const p=example.build(),e=new MechanicaEngine(p);e.advance(6);
    for(const part of p.parts){const m=e.metric(part.id)!;expect(Number.isFinite(m.energy+m.x+m.y)).toBe(true);expect(m.energy).toBeLessThan(100000);}
  });
  it('advances using exactly 120 fixed timesteps per second',()=>{
    const e=new MechanicaEngine(EXAMPLES[0].build());e.advance(1);expect(e.steps).toBe(120);expect(e.time).toBeCloseTo(1,10);expect(DT).toBe(1/120);
  });
  it('safe zero readings are available before the first physics timestep',()=>{
    const p=EXAMPLES[0].build(),e=new MechanicaEngine(p);
    for(const c of p.connections)expect(e.connectionMetric(c.id)).toEqual({slip:0,torque:0,force:0});
    for(const part of p.parts){const m=e.metric(part.id)!;expect(Number.isFinite(m.torque+m.reactionForce+m.energy)).toBe(true);}
  });
  it('steps 200 active mechanical parts without instability',()=>{
    const base=EXAMPLES[0].build(),parts:Project['parts']=[],connections:Project['connections']=[];
    for(let i=0;i<50;i++){const scene=EXAMPLES[0].build();for(const part of scene.parts){part.x+=(i%10)*9;part.y+=Math.floor(i/10)*6;}parts.push(...scene.parts);connections.push(...scene.connections);}
    const e=new MechanicaEngine({...base,parts,connections}),start=performance.now();e.advance(2);const elapsed=performance.now()-start;
    for(const part of parts)expect(Number.isFinite(e.metric(part.id)!.energy)).toBe(true);
    console.info('BENCHMARK '+JSON.stringify({parts:parts.length,joints:e.world.getJointCount(),simulatedSeconds:2,wallMilliseconds:Math.round(elapsed),stepsPerSecond:Math.round(240/elapsed*1000)}));
  });
});
