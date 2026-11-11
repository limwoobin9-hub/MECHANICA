import * as pl from 'planck';
import { type Part, type Project, type Connection, type Vec, ROTARY, LINEAR, LOGIC, radiusOf, inertiaOf, clone } from '../model/types';
import { validateMechanism } from './validation';

export const DT = 1 / 120;
export interface Metric {
  x: number; y: number; angle: number; vx: number; vy: number; speed: number; acceleration: number;
  omega: number; rpm: number; torque: number; reactionForce: number; force: number;
  energy: number; inputPower: number; outputPower: number; efficiency: number; signal: boolean;
}
export interface RuntimePart { part: Part; body: pl.Body; mount?: pl.RevoluteJoint | pl.PrismaticJoint; support?: pl.Body; previousV: Vec; acceleration: number; transmission: number }
interface Belt { connection: Connection; a: RuntimePart; b: RuntimePart; accumulated: number; slip: number; torque: number }
export class MechanicaEngine {
  readonly world: pl.World;
  readonly ground: pl.Body;
  readonly parts = new Map<string, RuntimePart>();
  readonly joints = new Map<string, pl.Joint>();
  readonly signals = new Map<string, boolean>();
  readonly warnings: string[] = [];
  readonly belts: Belt[] = [];
  readonly design: Project;
  time = 0;
  steps = 0;
  private phases = new Map<string, number>();
  private mouse?: pl.MouseJoint;
  private signalLinks: Connection[];
  private incoming = new Map<string,string[]>();
  private quality: Project['settings']['quality'];
  private connectionsByPart = new Map<string,Connection[]>();

  constructor(project: Project) {
    this.design = clone(project);
    const issues = validateMechanism(project).filter(i => i.level === 'error');
    if (issues.length) throw new Error(issues[0].message);
    this.world = new pl.World({ gravity: pl.Vec2(0, project.settings.gravity ? project.settings.gravityValue : 0), allowSleep: true });
    this.ground = this.world.createBody();
    this.quality = project.settings.quality;
    this.signalLinks = project.connections.filter(c => c.kind === 'signal' && c.enabled);
    for(const c of this.signalLinks)this.incoming.set(c.b,[...(this.incoming.get(c.b)??[]),c.a]);
    for(const c of project.connections){for(const id of [c.a,c.b])this.connectionsByPart.set(id,[...(this.connectionsByPart.get(id)??[]),c]);}
    for (const p of project.parts) this.createPart(clone(p));
    // Structural joints must exist before gear joints, including axes on moving carriers.
    const structural = project.connections.filter(c => c.enabled && ['hinge','weld','spring','rope'].includes(c.kind));
    const mechanical = project.connections.filter(c => c.enabled && !['hinge','weld','spring','rope','signal'].includes(c.kind));
    for (const c of [...structural, ...mechanical]) this.createConnection(c);
    this.installConveyors();
    for (const p of this.parts.values()) if (LOGIC.has(p.part.kind)) this.signals.set(p.part.id, false);
  }

  private createPart(p: Part) {
    const logical = LOGIC.has(p.kind), fixed = p.kind === 'frame' || logical;
    const body = this.world.createBody({ type: fixed ? 'static' : 'dynamic', position: pl.Vec2(p.x,p.y), angle: p.angle, linearDamping: p.damping, angularDamping: p.damping, allowSleep: true, bullet: !p.mounted && !logical, userData: { id: p.id } });
    const r: RuntimePart = { part: p, body, previousV: {x:0,y:0}, acceleration: 0, transmission: 0 };
    this.parts.set(p.id, r);
    if (logical) {
      if (p.kind === 'sensor' && p.sensorMode === 'contact') body.createFixture(new pl.Circle(Math.max(.05,Math.min(2,Math.abs(p.threshold)))), { isSensor: true });
      return;
    }
    let shape: pl.Shape;
    const round = ROTARY.has(p.kind) || p.kind === 'follower';
    if (p.kind === 'cam') shape = new pl.Circle(pl.Vec2(p.radius * .25,0), p.radius * .75);
    else shape = round ? new pl.Circle(radiusOf(p) * (p.kind==='gear'||p.kind==='ratchet' ? .91 : 1)) : new pl.Box(p.width/2,p.height/2);
    const layered = ROTARY.has(p.kind) && !['disc','cam'].includes(p.kind);
    body.createFixture(shape, { density: 1, friction: p.friction, restitution: p.restitution,
      isSensor: p.kind === 'motor' || p.kind === 'bearing' || p.kind === 'conveyor' || p.kind === 'torque' || p.kind === 'brake',
      filterCategoryBits: layered ? 2 : p.kind === 'rod' ? 4 : 1,
      filterMaskBits: layered || p.kind === 'rod' ? 0xfffd : 0xffff });
    if (!fixed) {
      body.setMassData({ mass: p.mass, center: pl.Vec2(0,0), I: inertiaOf(p) });
      body.setAngularVelocity(p.angularVelocity);
      body.setLinearVelocity(pl.Vec2(p.velocity*Math.cos(p.angle),p.velocity*Math.sin(p.angle)));
    }
    if (ROTARY.has(p.kind) && p.mounted) {
      r.mount = this.world.createJoint(new pl.RevoluteJoint({ collideConnected: false }, this.ground, body, body.getPosition()))!;
    } else if (LINEAR.has(p.kind)) {
      r.mount = this.world.createJoint(new pl.PrismaticJoint({ enableLimit: true, lowerTranslation: -p.travel/2, upperTranslation: p.travel/2 }, this.ground, body, body.getPosition(), pl.Vec2(Math.cos(p.angle),Math.sin(p.angle))))!;
    }
    if (p.kind === 'conveyor') {
      r.support = this.world.createBody({ position: pl.Vec2(p.x,p.y), angle: p.angle, userData: { id: p.id, conveyor: true } });
      r.support.createFixture(new pl.Box(p.width/2,p.height/2), { friction: p.friction, restitution: 0 });
    }
  }

  private createConnection(c: Connection) {
    const a=this.parts.get(c.a)!,b=this.parts.get(c.b)!;
    const A=a.body,B=b.body;
    const wa=A.getWorldPoint(c.portA),wb=B.getWorldPoint(c.portB);
    let joint: pl.Joint | null = null;
    if (c.kind === 'hinge') {
      const j = new pl.RevoluteJoint({ bodyA:A,bodyB:B,localAnchorA:c.portA,localAnchorB:c.portB,referenceAngle:B.getAngle()-A.getAngle(),collideConnected:false });
      joint=this.world.createJoint(j);
      if (ROTARY.has(b.part.kind) && !b.mount) b.mount=j;
      else if (ROTARY.has(a.part.kind) && !a.mount) {
        // Driven rotary bodies should be bodyB of their axis to preserve the sign of motor speed.
        this.world.destroyJoint(j);
        const reversed = new pl.RevoluteJoint({bodyA:B,bodyB:A,localAnchorA:c.portB,localAnchorB:c.portA,referenceAngle:A.getAngle()-B.getAngle(),collideConnected:false});
        joint=this.world.createJoint(reversed);a.mount=reversed;
      }
    } else if (c.kind === 'weld') {
      joint=this.world.createJoint(new pl.WeldJoint({collideConnected:false},A,B,wa));
    } else if (c.kind === 'spring') {
      const ma=A.isStatic()?Infinity:A.getMass(),mb=B.isStatic()?Infinity:B.getMass();
      const reduced=1/(1/ma+1/mb);
      const hz=Math.min(12,Math.sqrt(c.stiffness/reduced)/(2*Math.PI));
      const zeta=Math.min(2,c.damping/(2*Math.sqrt(c.stiffness*reduced)));
      joint=this.world.createJoint(new pl.DistanceJoint({bodyA:A,bodyB:B,localAnchorA:c.portA,localAnchorB:c.portB,length:Math.max(.03,c.restLength || pl.Vec2.distance(wa,wb)),frequencyHz:hz,dampingRatio:zeta,collideConnected:false}));
    } else if (c.kind === 'rope') {
      joint=this.world.createJoint(new pl.RopeJoint({bodyA:A,bodyB:B,localAnchorA:c.portA,localAnchorB:c.portB,maxLength:Math.max(.04,c.restLength || pl.Vec2.distance(wa,wb)),collideConnected:false}));
    } else if (['belt','crossed','clutch'].includes(c.kind)) {
      if (!a.mount || !b.mount) throw new Error('벨트와 클러치에는 각 부품의 회전축이 필요합니다. 축 고정을 켜거나 힌지로 축을 연결하세요.');
      this.belts.push({connection:clone(c),a,b,accumulated:0,slip:0,torque:0});
    } else if (c.kind==='gear'||c.kind==='shaft'||c.kind==='rack') {
      if(!a.mount||!b.mount)throw new Error('기어에는 회전축이 필요합니다. 축 고정을 켜거나 힌지로 축을 연결하세요.');
      let ratio = c.kind==='gear'?radiusOf(b.part)/radiusOf(a.part):-1;
      if(c.kind==='rack') {
        const gear=ROTARY.has(a.part.kind)?a:b, rack=LINEAR.has(b.part.kind)?b:a;
        const across=-(gear.part.x-rack.part.x)*Math.sin(rack.part.angle)+(gear.part.y-rack.part.y)*Math.cos(rack.part.angle);
        const k=(across<0?1:-1)*radiusOf(gear.part);
        ratio=gear===a?-1/k:-k;
      }
      joint=this.world.createJoint(new pl.GearJoint({bodyA:A,bodyB:B,joint1:a.mount,joint2:b.mount,ratio,collideConnected:false}));
    }
    if(joint)this.joints.set(c.id,joint);
  }

  private installConveyors() {
    this.world.on('pre-solve', contact => {
      const A=contact.getFixtureA().getBody(),B=contact.getFixtureB().getBody();
      const da=A.getUserData() as {id:string;conveyor?:boolean},db=B.getUserData() as {id:string;conveyor?:boolean};
      const data=da?.conveyor?da:db?.conveyor?db:null;
      if(!data)return;
      const r=this.parts.get(data.id)!;
      const normal=contact.getWorldManifold(null)?.normal;
      if(!normal)return;
      const tangent=pl.Vec2(normal.y,-normal.x), direction=pl.Vec2(Math.cos(r.part.angle),Math.sin(r.part.angle));
      const sign=da?.conveyor?1:-1;
      contact.setTangentSpeed(sign*pl.Vec2.dot(tangent,direction)*r.body.getAngularVelocity()*r.part.radius);
    });
    this.world.on('post-solve',(contact,impulse)=>{
      const da=contact.getFixtureA().getBody().getUserData() as {id:string;conveyor?:boolean},db=contact.getFixtureB().getBody().getUserData() as {id:string;conveyor?:boolean};
      const data=da?.conveyor?da:db?.conveyor?db:null;
      if(!data)return;
      const r=this.parts.get(data.id)!,normal=contact.getWorldManifold(null)?.normal;
      if(!normal)return;
      const tangent=pl.Vec2(normal.y,-normal.x),dir=pl.Vec2(Math.cos(r.part.angle),Math.sin(r.part.angle));
      const j=impulse.tangentImpulses.reduce((s,v)=>s+v,0)*(da?.conveyor?1:-1)*pl.Vec2.dot(tangent,dir);
      r.body.applyAngularImpulse(-j*r.part.radius,true);
    });
  }

  private inputValues(id: string) { return (this.incoming.get(id)??[]).map(source=>this.signals.get(source)??false); }
  private updateLogic() {
    const next=new Map<string,boolean>(),visiting=new Set<string>();
    const evaluate=(id:string):boolean=>{
      if(next.has(id))return next.get(id)!;
      // Feedback is a one-tick memory. Acyclic combinational gates settle in the same tick.
      if(visiting.has(id))return this.signals.get(id)??false;
      const r=this.parts.get(id);
      if(!r||!LOGIC.has(r.part.kind))return false;
      visiting.add(id);
      const p=r.part;
      const ins=(this.incoming.get(id)??[]).map(evaluate), enabled=p.enabled && (!ins.length || ins.some(Boolean));
      let value=false;
      switch(p.kind){
        case 'switch':case 'button':value=p.enabled;break;
        case 'timer':{
          const t=enabled?(this.phases.get(p.id)??0)+DT:0;this.phases.set(p.id,t);
          value=enabled && t%p.period<p.period/2;break;
        }
        case 'delay':{
          const t=enabled && ins.length?(this.phases.get(p.id)??0)+DT:0;this.phases.set(p.id,t);value=t>=p.period;break;
        }
        case 'and':value=p.enabled&&ins.length>0&&ins.every(Boolean);break;
        case 'or':case 'controller':value=p.enabled&&ins.some(Boolean);break;
        case 'not':value=p.enabled&&!(ins[0]??false);break;
        case 'sensor':{
          const target=this.parts.get(p.target);
          if(p.sensorMode==='speed')value=!!target&&Math.abs(target.body.getAngularVelocity()*60/(2*Math.PI))>=p.threshold;
          else if(p.sensorMode==='position')value=!!target&&target.body.getPosition().x>=p.threshold;
          else {
            for(let edge=r.body.getContactList();edge;edge=edge.next){const other=edge.other?.getUserData() as {id:string}|undefined;
              if(edge.other && edge.contact.isTouching() && (!p.target || other?.id===p.target) && !edge.other.isStatic()) {value=true;break;}}
          }
          value=value&&p.enabled;break;
        }
      }
      next.set(p.id,value);
      visiting.delete(id);return value;
    };
    for(const r of this.parts.values())if(LOGIC.has(r.part.kind))evaluate(r.part.id);
    this.signals.clear();for(const [id,v] of next)this.signals.set(id,v);
  }

  step() {
    this.updateLogic();
    for(const r of this.parts.values()) {
      r.transmission=0;
      const p=r.part,b=r.body;
      const ins=this.inputValues(p.id),on=p.enabled && (!ins.length || ins.some(Boolean));
      if(r.mount instanceof pl.RevoluteJoint) {
        const drive=on&&(p.motorEnabled||p.kind==='brake');
        r.mount.enableMotor(drive);
        r.mount.setMotorSpeed(p.kind==='brake'?0:p.rpm*2*Math.PI/60);
        r.mount.setMaxMotorTorque(p.maxTorque*(p.kind==='brake'?1:p.efficiency));
      }
      if(r.mount instanceof pl.PrismaticJoint) {
        r.mount.enableMotor(on && p.kind==='actuator');
        r.mount.setMotorSpeed(p.rpm/60);
        r.mount.setMaxMotorForce(Math.abs(p.force));
      }
      const w=b.getAngularVelocity();
      // Regularized Coulomb load avoids an unphysical sign flip around rest.
      if(p.load>0 && !b.isStatic())b.applyTorque(-p.load*Math.tanh(w/.08),true);
      if(on && p.kind==='torque')b.applyTorque(p.force,true);
      if(on && p.kind==='force')b.applyForceToCenter(pl.Vec2(p.force*Math.cos(p.angle),p.force*Math.sin(p.angle)),true);
    }
    const iterations=this.quality==='high'?{v:20,p:10}:this.quality==='balanced'?{v:12,p:6}:{v:8,p:4};
    this.world.step(DT,iterations.v,iterations.p);
    this.solveBelts();
    for(const r of this.parts.values()) {
      if(r.part.kind==='ratchet'&&r.body.getAngularVelocity()<0)r.body.applyAngularImpulse(-r.body.getAngularVelocity()*r.body.getInertia(),true);
      const v=r.body.getLinearVelocity();
      r.acceleration=Math.hypot(v.x-r.previousV.x,v.y-r.previousV.y)/DT;
      r.previousV={x:v.x,y:v.y};
      const p=r.body.getPosition();
      if(!Number.isFinite(p.x+p.y+r.body.getAngle()+v.x+v.y+r.body.getAngularVelocity())||Math.abs(p.x)>2000||Math.abs(p.y)>2000)throw new Error('물리 상태가 허용 범위를 벗어나 시뮬레이션을 일시정지했습니다. 연결과 치수를 확인하세요.');
    }
    this.time+=DT;this.steps++;
  }

  private solveBelts() {
    for(const belt of this.belts)belt.accumulated=0;
    // Sequential impulses change both shafts according to their effective inertia.
    // Total impulse per timestep is friction-limited; phase is intentionally unconstrained.
    for(let i=0;i<10;i++)for(const belt of this.belts){
      const {a,b,connection:c}=belt;
      const control=c.kind==='clutch'?this.inputValues(b.part.id):[];
      if(!c.enabled||c.kind==='clutch'&&(!b.part.enabled||control.length>0&&!control.some(Boolean)))continue;
      const ra=c.kind==='clutch'?1:radiusOf(a.part),rb=c.kind==='clutch'?1:radiusOf(b.part),sign=c.kind==='crossed'?1:-1;
      const invA=1/a.body.getInertia(),invB=1/b.body.getInertia();
      const slip=ra*a.body.getAngularVelocity()+sign*rb*b.body.getAngularVelocity();
      const delta=-slip/(ra*ra*invA+rb*rb*invB);
      const limit=c.tension*c.friction*DT;
      const total=Math.max(-limit,Math.min(limit,belt.accumulated+delta)),j=total-belt.accumulated;
      a.body.applyAngularImpulse(ra*j,true);b.body.applyAngularImpulse(sign*rb*j,true);
      belt.accumulated=total;
    }
    for(const belt of this.belts){
      const ra=belt.connection.kind==='clutch'?1:radiusOf(belt.a.part),rb=belt.connection.kind==='clutch'?1:radiusOf(belt.b.part);
      belt.slip=Math.abs(ra*belt.a.body.getAngularVelocity()+(belt.connection.kind==='crossed'?1:-1)*rb*belt.b.body.getAngularVelocity());
      belt.torque=Math.abs(belt.accumulated*ra/DT);
      belt.a.transmission+=belt.torque;belt.b.transmission+=Math.abs(belt.accumulated*rb/DT);
    }
  }

  metric(id: string): Metric | undefined {
    const r=this.parts.get(id);if(!r)return;
    const b=r.body,p=r.part,v=b.getLinearVelocity(),w=b.getAngularVelocity(),pos=b.getPosition();
    const motor=r.mount instanceof pl.RevoluteJoint&&r.mount.isMotorEnabled()?r.mount.getMotorTorque(1/DT):0;
    let transmitted=r.transmission;
    for(const c of this.connectionsByPart.get(id)??[]){
      const j=this.joints.get(c.id);if(!j||this.steps===0)continue;
      let t=Math.abs(j.getReactionTorque(1/DT));
      if(j instanceof pl.GearJoint && c.a===id)t/=Math.abs(j.getRatio());
      transmitted=Math.max(transmitted,t);
    }
    const ins=this.inputValues(id),on=p.enabled&&(!ins.length||ins.some(Boolean));
    const torque=(p.motorEnabled||p.kind==='brake')?motor:p.kind==='torque'?(on?p.force:0):transmitted;
    const speed=Math.hypot(v.x,v.y);
    const linearForce=p.kind==='force'?(on?p.force:0):p.kind==='actuator'&&r.mount instanceof pl.PrismaticJoint?r.mount.getMotorForce(1/DT):0;
    const linearPower=linearForce*(v.x*Math.cos(p.angle)+v.y*Math.sin(p.angle));
    const input=Math.max(0,motor*w)/p.efficiency+Math.max(0,linearPower)+((p.kind==='torque'&&on)?Math.max(0,p.force*w):0);
    return {x:pos.x,y:pos.y,angle:b.getAngle(),vx:v.x,vy:v.y,speed,acceleration:r.acceleration,omega:w,rpm:w*60/(2*Math.PI),torque,
      reactionForce:r.mount?r.mount.getReactionForce(1/DT).length():0,force:linearForce,
      energy:.5*b.getMass()*speed*speed+.5*b.getInertia()*w*w,
      inputPower:input,outputPower:p.load*w*Math.tanh(w/.08),efficiency:p.efficiency,signal:this.signals.get(id)??false};
  }
  pose(id:string): {x:number;y:number;angle:number}|undefined {const r=this.parts.get(id);if(!r)return;const p=r.body.getPosition();return{x:p.x,y:p.y,angle:r.body.getAngle()};}
  advance(seconds:number){for(let i=0,n=Math.round(seconds/DT);i<n;i++)this.step();}
  setLive(id:string,patch:Partial<Part>){const r=this.parts.get(id);if(r){Object.assign(r.part,patch);r.body.setAwake(true);}}
  setConnectionLive(id:string,patch:Partial<Connection>){const belt=this.belts.find(b=>b.connection.id===id);if(belt){Object.assign(belt.connection,patch);belt.a.body.setAwake(true);belt.b.body.setAwake(true);}}
  setGravity(enabled:boolean,value:number){this.world.setGravity(pl.Vec2(0,enabled?value:0));for(const r of this.parts.values())r.body.setAwake(true);}
  impulse(id:string,value:Vec){const r=this.parts.get(id);if(r&&!r.body.isStatic())r.body.applyLinearImpulse(value,r.body.getWorldCenter(),true);}
  angularImpulse(id:string,value:number){const r=this.parts.get(id);if(r&&!r.body.isStatic())r.body.applyAngularImpulse(value,true);}
  startDrag(id:string,point:Vec){this.endDrag();const r=this.parts.get(id);if(!r||r.body.isStatic())return;this.mouse=this.world.createJoint(new pl.MouseJoint({maxForce:Math.min(10000,r.part.mass*150),frequencyHz:4,dampingRatio:.85},this.ground,r.body,point))!;r.body.setAwake(true);}
  drag(point:Vec){this.mouse?.setTarget(point);}
  endDrag(){if(this.mouse){this.world.destroyJoint(this.mouse);this.mouse=undefined;}}
  energy(){let e=0;for(const id of this.parts.keys())e+=this.metric(id)!.energy;for(const c of this.design.connections){if(c.kind!=='spring'||!c.enabled)continue;const a=this.parts.get(c.a)!,b=this.parts.get(c.b)!,d=pl.Vec2.distance(a.body.getWorldPoint(c.portA),b.body.getWorldPoint(c.portB));e+=.5*c.stiffness*(d-(c.restLength||Math.hypot(a.part.x-b.part.x,a.part.y-b.part.y)))**2;}return e;}
  connectionMetric(id:string){if(this.steps===0)return{slip:0,torque:0,force:0};const belt=this.belts.find(b=>b.connection.id===id);if(belt)return{slip:belt.slip,torque:belt.torque,force:Math.abs(belt.accumulated/DT)};const j=this.joints.get(id);return j?{slip:0,torque:j.getReactionTorque(1/DT),force:j.getReactionForce(1/DT).length()}:undefined;}
  get contacts(){const points:Vec[]=[];for(let c=this.world.getContactList();c;c=c.getNext()){if(c.isTouching()){const wm=c.getWorldManifold(null);if(wm)for(const p of wm.points)if(p)points.push({x:p.x,y:p.y});}}return points;}
}
