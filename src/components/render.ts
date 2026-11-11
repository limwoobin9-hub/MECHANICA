import { type Part, type Project, type Vec, type Connection, ROTARY, LINEAR, LOGIC, radiusOf, localToWorld } from '../model/types';
import { type MechanicaEngine } from '../physics/engine';
type C=CanvasRenderingContext2D;
export const COLORS={silver:'#bdcbd5',mint:'#84d9b7',blue:'#8db7dd',amber:'#dfb67b'};
const ink='#101920';
function circle(c:C,x:number,y:number,r:number){c.beginPath();c.arc(x,y,r,0,Math.PI*2);}
function round(c:C,x:number,y:number,w:number,h:number,r:number){c.beginPath();c.roundRect(x,y,w,h,r);}
function pin(c:C,r:number,scale:number){
  circle(c,0,0,r);c.fillStyle='#1a2830';c.fill();c.strokeStyle='#89a7ac';c.lineWidth=1/scale;c.stroke();
  circle(c,0,0,r*.45);c.fillStyle='#68d7ae';c.fill();
  c.strokeStyle='#152c28';c.lineWidth=1.5/scale;c.beginPath();c.moveTo(-r*.22,0);c.lineTo(r*.22,0);c.stroke();
}
function metal(c:C,r:number,color:string){const g=c.createRadialGradient(-r*.25,-r*.4,.01,0,0,r*1.3);g.addColorStop(0,color);g.addColorStop(.55,color);g.addColorStop(1,'#5e7582');return g;}
const gearPaths=new Map<string,Path2D>();
function teeth(r:number,n:number,module:number){
  const key=`${r}/${n}/${module}`,cached=gearPaths.get(key);if(cached)return cached;
  const c=new Path2D();const root=r-module*1.15,tip=r+module,step=2*Math.PI/n;
  for(let i=0;i<n;i++)for(const[off,rad]of[[-.5,root],[-.32,root],[-.19,tip],[.19,tip],[.32,root],[.5,root]]){
    const a=(i+off)*step,x=Math.cos(a)*rad,y=Math.sin(a)*rad;
    if(i===0&&off===-.5)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();if(gearPaths.size>128)gearPaths.delete(gearPaths.keys().next().value!);gearPaths.set(key,c);return c;
}
export function partBounds(p:Part){const r=radiusOf(p);if(ROTARY.has(p.kind))return{x:p.x-r,y:p.y-r,w:r*2,h:r*2};const w=LOGIC.has(p.kind)?1.25:p.width,h=LOGIC.has(p.kind)?.72:p.height;return{x:p.x-w/2,y:p.y-h/2,w,h};}
export function drawPart(c:C,p:Part,selected:boolean,hover:boolean,scale:number,engine:MechanicaEngine|null){
  const pose=engine?.pose(p.id)??p,r=radiusOf(p),color=COLORS[p.color];
  const position=p.kind==='conveyor'?p:pose;
  c.save();c.translate(position.x,position.y);
  if(p.mounted&&ROTARY.has(p.kind)&&p.kind!=='conveyor'){
    c.save();c.strokeStyle=selected?'#46866f70':'#6c879b24';c.lineWidth=1/scale;c.setLineDash([.07,.06]);c.beginPath();c.moveTo(-r*1.32,0);c.lineTo(r*1.32,0);c.moveTo(0,-r*1.32);c.lineTo(0,r*1.32);c.stroke();c.restore();
  }
  if(LINEAR.has(p.kind)){
    c.save();c.rotate(p.angle);c.strokeStyle='#718b9a55';c.lineWidth=1/scale;
    const span=Math.min(5,p.travel/2+.5);c.setLineDash([.12,.1]);c.beginPath();c.moveTo(-span,0);c.lineTo(span,0);c.stroke();c.setLineDash([]);
    if(p.kind==='piston'||p.kind==='actuator'){
      c.fillStyle='#66829609';round(c,p.x-position.x-p.travel/2-p.width/2,-p.height/2-.13,p.travel+p.width,p.height+.26,.05);c.fill();c.strokeStyle='#677e8a66';c.stroke();
      c.beginPath();c.moveTo(-span,-p.height/2-.18);c.lineTo(span,-p.height/2-.18);c.moveTo(-span,p.height/2+.18);c.lineTo(span,p.height/2+.18);c.stroke();
    }
    c.restore();
  }
  c.rotate(position.angle);c.lineWidth=1.4/scale;c.strokeStyle=selected?'#92f0c8':hover?'#e1f4f3':'#d8e7eb90';
  if(LOGIC.has(p.kind)){
    c.rotate(-position.angle);
    const on=engine?.signals.get(p.id)??(p.kind==='switch'&&p.enabled);
    if(p.kind==='sensor'&&p.sensorMode==='contact'){
      c.save();circle(c,0,0,Math.min(2,Math.abs(p.threshold)));c.fillStyle=on?'#b798f220':'#b798f208';c.fill();c.strokeStyle='#b798f255';c.setLineDash([.07,.07]);c.stroke();c.restore();
    }
    round(c,-.6,-.35,1.2,.7,.12);c.fillStyle=on?'#3b3354':'#20232f';c.fill();c.strokeStyle=selected?'#c8adf7':on?'#b798f2':'#646078';c.stroke();
    c.fillStyle=on?'#e3d4ff':'#b5a4d4';c.font=`600 ${Math.min(14/scale,.23)}px ui-monospace,monospace`;c.textAlign='center';c.textBaseline='middle';
    c.fillText(({switch:p.enabled?'ON':'OFF',button:'PUSH',timer:'TIMER',delay:'DELAY',sensor:p.sensorMode==='speed'?'RPM':p.sensorMode==='position'?'POS':'TOUCH',and:'AND',or:'OR',not:'NOT',controller:'CTRL'}as Record<string,string>)[p.kind],0,0);
    for(const x of[-.6,.6]){circle(c,x,0,.055);c.fillStyle=on?'#c3a3fd':'#7b6c9c';c.fill();}
  }else if(p.kind==='gear'||p.kind==='ratchet'){
    const path=teeth(r,p.teeth,p.module);c.fillStyle=metal(c,r,color);c.shadowColor='#00000055';c.shadowBlur=10/scale;c.shadowOffsetY=.04;c.fill(path);c.shadowBlur=0;c.shadowOffsetY=0;c.stroke(path);
    circle(c,0,0,r*.76);c.strokeStyle='#3e566940';c.lineWidth=1/scale;c.stroke();
    const holes=p.teeth>=36?6:4;
    for(let i=0;i<holes;i++){const a=i*Math.PI*2/holes;circle(c,Math.cos(a)*r*.52,Math.sin(a)*r*.52,r*(p.teeth>=36?.17:.14));c.fillStyle=ink;c.fill();c.strokeStyle='#4a626f';c.stroke();}
    circle(c,0,0,r*.27);c.fillStyle='#7895a3';c.fill();c.strokeStyle='#d8e8eb90';c.stroke();pin(c,r*.15,scale);
    if(p.group==='clock'){c.strokeStyle='#80e2ba';c.lineWidth=.035;c.beginPath();c.moveTo(0,0);c.lineTo(0,-r*.65);c.stroke();}
  }else if(p.kind==='crank'){
    circle(c,0,0,r);c.fillStyle=metal(c,r,color);c.fill();c.stroke();
    circle(c,-r*.22,0,r*.44);c.fillStyle=ink;c.fill();
    round(c,-r*.1,-r*.17,r*.94,r*.34,r*.15);c.fillStyle=color;c.fill();c.stroke();pin(c,r*.15,scale);
    c.save();c.translate(r*.72,0);pin(c,r*.105,scale);c.restore();
  }else if(p.kind==='pulley'||p.kind==='flywheel'||p.kind==='disc'||p.kind==='bearing'||p.kind==='torque'||p.kind==='brake'||p.kind==='motor'){
    circle(c,0,0,r);c.fillStyle=p.kind==='motor'?'#385a50':p.kind==='brake'?'#684549':metal(c,r,color);c.fill();c.stroke();
    circle(c,0,0,r*.84);c.strokeStyle='#172730';c.lineWidth=Math.max(2/scale,r*.075);c.stroke();
    if(p.kind==='flywheel')for(let i=0;i<6;i++){const a=i*Math.PI/3;circle(c,Math.cos(a)*r*.5,Math.sin(a)*r*.5,r*.18);c.fillStyle=ink;c.fill();}
    if(p.kind==='disc'){c.fillStyle='#1a2730';circle(c,0,0,r*.68);c.fill();for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);round(c,r*.22,-r*.07,r*.38,r*.14,r*.04);c.fillStyle='#7d98aa';c.fill();c.restore();}}
    c.strokeStyle='#ffffff66';c.lineWidth=1/scale;c.beginPath();c.moveTo(r*.44,0);c.lineTo(r*.72,0);c.stroke();pin(c,r*.17,scale);
  }else if(p.kind==='cam'){
    circle(c,r*.25,0,r*.75);c.fillStyle=metal(c,r,color);c.fill();c.stroke();pin(c,r*.13,scale);
  }else if(p.kind==='follower'){
    circle(c,0,0,p.radius);c.fillStyle=metal(c,p.radius,color);c.fill();c.stroke();pin(c,p.radius*.4,scale);
  }else if(p.kind==='conveyor'){
    const w=p.width,h=p.height;
    round(c,-w/2,-h/2,w,h,h/2);c.fillStyle='#22323e';c.fill();c.strokeStyle='#7f9fb8';c.stroke();
    round(c,-w/2+.06,-h/2+.06,w-.12,h-.12,h/2);c.strokeStyle='#364e61';c.lineWidth=.05;c.stroke();
    const rotation=pose.angle-p.angle;
    const offset=((rotation*p.radius)%.22+.22)%.22;
    c.save();round(c,-w/2+.08,-h/2+.05,w-.16,h-.1,h/2);c.clip();c.strokeStyle='#718b9a';c.lineWidth=.025;
    for(let x=-w/2-.22+offset;x<w/2+.22;x+=.22){c.beginPath();c.moveTo(x,-h/2);c.lineTo(x,h/2);c.stroke();}c.restore();
    for(const x of[-w/2+h/2,w/2-h/2]){circle(c,x,0,h*.3);c.fillStyle='#16252e';c.fill();c.strokeStyle='#7695a9';c.lineWidth=.025;c.stroke();}
    c.strokeStyle='#577386';c.lineWidth=.09;for(const x of[-w*.3,w*.3]){c.beginPath();c.moveTo(x,h/2);c.lineTo(x,h/2+.7);c.moveTo(x-.3,h/2+.7);c.lineTo(x+.3,h/2+.7);c.stroke();}
  }else if(p.kind==='rod'){
    round(c,-p.width/2-p.height*.4,-p.height/2,p.width+p.height*.8,p.height,p.height/2);c.fillStyle=metal(c,p.width/2,color);c.fill();c.stroke();
    for(const x of[-p.width/2,p.width/2]){c.save();c.translate(x,0);pin(c,p.height*.65,scale);c.restore();}
  }else{
    round(c,-p.width/2,-p.height/2,p.width,p.height,Math.min(.07,p.height*.14));c.fillStyle=p.kind==='frame'?'#2b3945':metal(c,p.width/2,color);c.fill();c.strokeStyle=p.kind==='frame'?'#5e7484':'#d2e0e580';c.stroke();
    if(p.kind==='frame'){
      c.save();c.clip();c.strokeStyle='#60778460';c.lineWidth=1/scale;for(let x=-p.width/2-p.height;x<p.width/2+p.height;x+=.18){c.beginPath();c.moveTo(x,p.height/2);c.lineTo(x+p.height,-p.height/2);c.stroke();}c.restore();
    }else if(p.kind==='rack'){
      c.fillStyle=color;for(let x=-p.width/2+.05;x<p.width/2-.03;x+=p.module*Math.PI){c.beginPath();c.moveTo(x,-p.height/2);c.lineTo(x+p.module*.6,-p.height/2-p.module*1.4);c.lineTo(x+p.module*1.9,-p.height/2-p.module*1.4);c.lineTo(x+p.module*2.5,-p.height/2);c.fill();}
    }else if(p.kind==='piston'||p.kind==='actuator'){
      c.strokeStyle='#36505f';c.lineWidth=.025;for(const x of[-p.width*.32,-p.width*.2,p.width*.2,p.width*.32]){c.beginPath();c.moveTo(x,-p.height/2);c.lineTo(x,p.height/2);c.stroke();}pin(c,p.height*.12,scale);
    }else{for(const x of[-p.width*.34,p.width*.34]){circle(c,x,0,.035);c.fillStyle='#557080';c.fill();}}
  }
  if(selected&&!LOGIC.has(p.kind)){
    c.strokeStyle='#78e2b8';c.lineWidth=1.5/scale;
    if(ROTARY.has(p.kind)){circle(c,0,0,r+(p.kind==='gear'?p.module:0)+.08);c.setLineDash([4/scale,4/scale]);c.stroke();}
    else{c.setLineDash([4/scale,4/scale]);round(c,-p.width/2-.08,-p.height/2-.08,p.width+.16,p.height+.16,.07);c.stroke();}
  }
  c.restore();
}
function line(c:C,a:Vec,b:Vec){c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);}
export function drawConnection(c:C,connection:Connection,project:Project,engine:MechanicaEngine|null,scale:number,index?:Map<string,Part>){
  const a=index?index.get(connection.a):project.parts.find(p=>p.id===connection.a),b=index?index.get(connection.b):project.parts.find(p=>p.id===connection.b);if(!a||!b)return;
  const pa=engine?.pose(a.id)??a,pb=engine?.pose(b.id)??b,A=localToWorld(pa,connection.portA),B=localToWorld(pb,connection.portB);
  c.save();c.lineWidth=1.5/scale;
  if(!connection.enabled)c.globalAlpha=.25;
  if(['belt','crossed','clutch'].includes(connection.kind)){
    if(connection.kind==='clutch'){
      circle(c,pa.x,pa.y,Math.min(radiusOf(a),radiusOf(b))*.5);c.strokeStyle='#c3a3f9';c.lineWidth=.045;c.setLineDash([.07,.05]);c.stroke();
    }else{
      const ra=radiusOf(a)+.035,rb=radiusOf(b)+.035,dx=pb.x-pa.x,dy=pb.y-pa.y,d=Math.hypot(dx,dy);
      if(d<=Math.abs(ra-rb))return;
      const cos=(ra-rb)/d,sin=Math.sqrt(1-cos*cos),nx=dx/d,ny=dy/d;
      const n1={x:cos*nx-sin*ny,y:cos*ny+sin*nx},n2={x:cos*nx+sin*ny,y:cos*ny-sin*nx};
      c.beginPath();c.moveTo(pa.x+ra*n1.x,pa.y+ra*n1.y);
      if(connection.kind==='crossed'){
        c.lineTo(pb.x-rb*n1.x,pb.y-rb*n1.y);c.arc(pb.x,pb.y,rb,Math.atan2(-n1.y,-n1.x),Math.atan2(-n2.y,-n2.x),true);c.lineTo(pa.x+ra*n2.x,pa.y+ra*n2.y);c.arc(pa.x,pa.y,ra,Math.atan2(n2.y,n2.x),Math.atan2(n1.y,n1.x),true);
      }else{
        c.lineTo(pb.x+rb*n1.x,pb.y+rb*n1.y);c.arc(pb.x,pb.y,rb,Math.atan2(n1.y,n1.x),Math.atan2(n2.y,n2.x),true);c.lineTo(pa.x+ra*n2.x,pa.y+ra*n2.y);c.arc(pa.x,pa.y,ra,Math.atan2(n2.y,n2.x),Math.atan2(n1.y,n1.x),true);
      }
      c.closePath();c.strokeStyle='#10171d';c.lineWidth=.12;c.stroke();c.strokeStyle='#8097a5';c.lineWidth=.075;c.stroke();c.strokeStyle='#d7e3e5';c.lineWidth=.02;c.setLineDash([.07,.1]);c.lineDashOffset=-(pa.angle-a.angle)*ra;c.stroke();
    }
  }else if(connection.kind==='spring'){
    const dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);if(!d)return;const nx=-dy/d,ny=dx/d;
    c.strokeStyle='#dfb67b';c.lineWidth=.035;c.beginPath();c.moveTo(A.x,A.y);
    for(let i=0;i<=26;i++){const t=.12+i/26*.76,side=i===0||i===26?0:i%2?.13:-.13;c.lineTo(A.x+dx*t+nx*side,A.y+dy*t+ny*side);}c.lineTo(B.x,B.y);c.stroke();
    if(connection.damping>2){line(c,{x:A.x+nx*.3,y:A.y+ny*.3},{x:B.x+nx*.3,y:B.y+ny*.3});c.strokeStyle='#899fb2';c.lineWidth=.035;c.stroke();}
  }else if(connection.kind==='rope'){
    const d=Math.hypot(B.x-A.x,B.y-A.y),slack=Math.max(0,connection.restLength-d);c.beginPath();c.moveTo(A.x,A.y);c.quadraticCurveTo((A.x+B.x)/2,(A.y+B.y)/2+Math.min(1,slack),B.x,B.y);c.strokeStyle='#b8bfc6';c.lineWidth=.025;c.stroke();
  }else if(connection.kind==='signal'){
    const active=engine?.signals.get(a.id);c.beginPath();c.moveTo(pa.x+.6,pa.y);const dx=Math.max(.4,Math.abs(pb.x-pa.x)*.45);c.bezierCurveTo(pa.x+.6+dx,pa.y,pb.x-.6-dx,pb.y,pb.x-.6,pb.y);c.strokeStyle=active?'#c4a2ff':'#7c6b9c';c.setLineDash([.07,.07]);c.stroke();
    circle(c,pb.x-.6,pb.y,.045);c.fillStyle=active?'#d1b6ff':'#8d79ad';c.fill();
  }else if(connection.kind==='hinge'){
    circle(c,A.x,A.y,.067);c.fillStyle='#8ed7ba';c.fill();circle(c,A.x,A.y,.025);c.fillStyle=ink;c.fill();
  }else if(connection.kind==='weld'){
    line(c,A,B);c.strokeStyle='#86b7e5';c.setLineDash([.08,.05]);c.stroke();
  }else if(connection.kind==='gear'){
    line(c,pa,pb);c.strokeStyle='#76c9ac38';c.setLineDash([.04,.07]);c.stroke();
    const ra=radiusOf(a),rb=radiusOf(b),t=ra/(ra+rb),x=pa.x+(pb.x-pa.x)*t,y=pa.y+(pb.y-pa.y)*t;circle(c,x,y,.04);c.fillStyle='#8fe6bf';c.fill();
  }
  c.restore();
}
export function drawAnnotations(c:C,p:Part,scale:number,engine:MechanicaEngine|null,selected:boolean){
  const pose=engine?.pose(p.id)??p;
  const r=ROTARY.has(p.kind)?radiusOf(p):LOGIC.has(p.kind)?.5:p.height/2;
  c.save();c.textAlign='center';c.textBaseline='middle';
  if(p.kind==='motor'){
    const x=pose.x,y=pose.y+Math.max(r,.75)+.35;
    c.fillStyle='#19352c';round(c,x-.52,y-.13,1.04,.26,.05);c.fill();c.strokeStyle='#4a8d7350';c.lineWidth=1/scale;c.stroke();c.fillStyle='#92dbb9';c.font=`500 ${10/scale}px ui-monospace,monospace`;c.fillText(`M · ${p.rpm} RPM`,x,y);c.restore();return;
  }
  c.fillStyle=selected?'#d4e8e2':'#9baeb9';c.font=`500 ${11/scale}px system-ui,sans-serif`;c.fillText(p.name,pose.x,pose.y-r-.3);
  if(p.kind==='gear'||p.kind==='ratchet'){
    c.fillStyle=selected?'#80d5b1':'#6f8795';c.font=`400 ${10/scale}px ui-monospace,monospace`;c.fillText(`${p.teeth}T  /  Ø ${(r*2).toFixed(2)} m`,pose.x,pose.y+r+.26);
    if(engine){c.fillStyle=selected?'#84e4ba':'#9ab9b0';c.fillText(`${(engine.parts.get(p.id)!.body.getAngularVelocity()*60/(2*Math.PI)).toFixed(1)} RPM`,pose.x,pose.y+r+.48);}
  }
  c.restore();
}
export function drawVector(c:C,from:Vec,to:Vec,color:string,scale:number){c.save();line(c,from,to);c.strokeStyle=color;c.lineWidth=1.5/scale;c.stroke();const a=Math.atan2(to.y-from.y,to.x-from.x),l=6/scale;c.beginPath();c.moveTo(to.x,to.y);c.lineTo(to.x-l*Math.cos(a-.4),to.y-l*Math.sin(a-.4));c.lineTo(to.x-l*Math.cos(a+.4),to.y-l*Math.sin(a+.4));c.closePath();c.fillStyle=color;c.fill();c.restore();}
