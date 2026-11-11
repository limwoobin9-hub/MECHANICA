import { makePart as part, makeConnection as link, springKit } from './library';
import { type Project, type Part, type Connection, DEFAULT_SETTINGS, uid, radiusOf, localToWorld } from './types';
export interface Example { id: string; name: string; subtitle: string; category: string; build: () => Project }
function project(name: string, description: string, parts: Part[], connections: Connection[], gravity = false): Project {
  return { format: 'mechanica', version: 1, id: uid(), name, description, parts, connections, settings: { ...DEFAULT_SETTINGS, gravity }, modified: Date.now() };
}
function train(name: string, counts: number[], rpm = 120): Project {
  let x = -3.3;
  const gears = counts.map((teeth, i) => {
    if (i) x += (counts[i-1] + teeth) * .025;
    return part('gear', x, 0, { name: `평기어 ${String(i + 1).padStart(2, '0')}`, teeth, mass: 1.3 + teeth * .055, color: i === 1 ? 'mint' : 'silver', angle: i % 2 ? Math.PI / teeth : 0 });
  });
  const motor = part('motor', gears[0].x, 0, { name: '구동 모터', rpm, maxTorque: 8 });
  const connections = [link('shaft', motor.id, gears[0].id), ...gears.slice(1).map((g, i) => link('gear', gears[i].id, g.id))];
  return project(name, '모터의 토크가 3개의 기어를 구동합니다. 가운데 기어에 부하를 추가해 모터의 속도와 토크를 비교해 보세요.', [motor, ...gears], connections);
}
function crankMachine(withGears = false): Project {
  const crank = part('crank', withGears ? -1 : -2, 0, { name: '크랭크샤프트', radius: .85, angle: -.65, mass: 3 });
  const pin = localToWorld(crank, { x: crank.radius * .72, y: 0 });
  const length = 2.4;
  const px = pin.x + Math.sqrt(length ** 2 - pin.y ** 2);
  const rod = part('rod', (pin.x + px) / 2, pin.y / 2, { name: '커넥팅 로드', width: length, angle: Math.atan2(-pin.y, px - pin.x), mass: .6 });
  const piston = part('piston', px, 0, { name: '피스톤', mass: 1.8, travel: 3 });
  const motor = part('motor', withGears ? -2.8 : -2, 0, { rpm: 80, maxTorque: 10, name: '입력 모터' });
  const parts = [motor, crank, rod, piston];
  const connections = [link('hinge', crank.id, rod.id, { portA: { x: crank.radius * .72, y: 0 }, portB: { x: -length / 2, y: 0 } }), link('hinge', rod.id, piston.id, { portA: { x: length / 2, y: 0 } })];
  if (withGears) {
    const input = part('gear', -2.8, 0, { teeth: 24, name: '입력 기어 · 24T' });
    const output = part('gear', -1, 0, { teeth: 48, name: '출력 기어 · 48T', color: 'mint', mass: 5 });
    parts.push(input, output);
    connections.push(link('shaft', motor.id, input.id), link('gear', input.id, output.id), link('shaft', output.id, crank.id));
  } else connections.push(link('shaft', motor.id, crank.id));
  return project(withGears ? '복합 자동화 기계' : '크랭크–피스톤', '회전축, 편심 핀, 연결봉의 두 회전 관절과 피스톤의 직선 관절이 실제 제약조건으로 연결됩니다. 피스톤에 외력을 가하면 입력축에도 부하가 전달됩니다.', parts, connections);
}
export const EXAMPLES: Example[] = [
  { id: 'gear-train', name: '기본 기어 트레인', subtitle: '3 gears · torque transmission', category: '기어 시스템', build: () => train('정밀 기어 트레인', [24, 48, 36]) },
  { id: 'reducer', name: '2단 복합 감속기', subtitle: '9:1 · compound reduction', category: '기어 시스템', build: () => {
    const a = part('gear', -3, 0, { teeth: 16, name: '1단 입력 · 16T' });
    const b = part('gear', -1.4, 0, { teeth: 48, name: '1단 출력 · 48T', mass: 5, color: 'mint' });
    const c = part('gear', -1.4, 0, { teeth: 16, name: '2단 입력 · 16T', color: 'amber' });
    const d = part('gear', .2, 0, { teeth: 48, name: '2단 출력 · 48T', mass: 5 });
    const m = part('motor', -3, 0, { rpm: 180, maxTorque: 6 });
    return project('2단 복합 감속기', '두 개의 3:1 감속 단계를 동축으로 연결했습니다. 이상적 출력은 입력의 1/9 속도이며 부하는 관성 및 모터 토크에 반영됩니다.', [m, b, d, a, c], [link('shaft',m.id,a.id),link('gear',a.id,b.id),link('shaft',b.id,c.id),link('gear',c.id,d.id)]);
  } },
  { id: 'crank', name: '크랭크–피스톤', subtitle: 'Rotation ↔ linear motion', category: '운동 변환', build: () => crankMachine() },
  { id: 'belt', name: '벨트 구동 장치', subtitle: 'Traction · tension · slip', category: '동력 전달', build: () => {
    const a = part('pulley', -2, 0, { radius: .6, name: '구동 풀리', color: 'mint' });
    const b = part('pulley', 1.8, 0, { radius: 1.05, name: '종동 풀리', mass: 5 });
    const m = part('motor', -2, 0, { rpm: 100, maxTorque: 12 });
    return project('벨트 구동 장치', '벨트는 한정된 장력과 마찰로 접선 충격량을 전달합니다. 종동 풀리의 부하를 높이면 벨트가 미끄러집니다. 연결 속성에서 장력과 마찰을 바꿔 보세요.', [m,a,b], [link('shaft',m.id,a.id),link('belt',a.id,b.id,{ tension: 22, friction: .5 })]);
  } },
  { id: 'spring', name: '스프링 진동 장치', subtitle: 'Mass · stiffness · damping', category: '탄성 시스템', build: () => {
    const kit = springKit({ x: 0, y: 0 });
    return project('감쇠 스프링 진동', '늘어난 스프링이 질량을 당기며 진동합니다. 스프링 연결의 강성과 감쇠를 조절하면 진동 주기와 에너지 소산이 변합니다.', kit.parts, kit.connections);
  } },
  { id: 'clock', name: '기계식 시계 구동계', subtitle: '12 → 36 → 60 teeth', category: '기어 시스템', build: () => {
    const p = train('기계식 시계 구동계', [12, 36, 60], 12);
    p.description = '저속의 일정한 동력원과 감속 기어를 이용한 시계 구동 구조입니다. 추·이스케이프먼트·시간 보정은 포함하지 않는 교육용 기어 구동계입니다.';
    p.parts[0].maxTorque = 2;
    p.parts.at(-1)!.group = 'clock';
    return p;
  } },
  { id: 'car', name: '자동차 구동계', subtitle: 'Motor · gears · wheel traction', category: '동력 전달', build: () => {
    const chassis = part('box', 0, 0, { width: 3.4, height: .45, mass: 5, name: '차체', color: 'blue' });
    const rear = part('disc', -1.15, .6, { radius: .85, mass: 1, friction: 1, name: '뒤 바퀴' });
    const front = part('disc', 1.15, .6, { radius: .85, mass: 1, friction: 1, name: '구동 바퀴' });
    const driven = part('gear', 1.15, .6, { teeth: 34, mass: 1, mounted: false, name: '차축 기어 · 34T' });
    const a = part('gear', 0, .6, { teeth: 12, mounted: false, motorEnabled: true, rpm: 150, maxTorque: 5, name: '모터 기어 · 12T', color: 'mint' });
    const floor = part('frame', 0, 1.6, { width: 18, height: .3, name: '주행 바닥' });
    return project('자동차 구동계', '차체에 연결된 모터 기어가 감속 기어와 차축을 구동합니다. 바퀴와 지면의 실제 마찰로 차체가 움직입니다. 모터 RPM 부호로 주행 방향을 바꿉니다.', [floor,chassis,rear,front,driven,a], [link('hinge',chassis.id,rear.id,{portA:{x:-1.15,y:.6}}),link('hinge',chassis.id,front.id,{portA:{x:1.15,y:.6}}),link('hinge',chassis.id,driven.id,{portA:{x:1.15,y:.6}}),link('hinge',chassis.id,a.id,{portA:{x:0,y:.6}}),link('gear',a.id,driven.id),link('shaft',driven.id,front.id)], true);
  } },
  { id: 'conveyor', name: '자동화 컨베이어', subtitle: 'Sensor → logic → motor', category: '자동화', build: () => {
    const belt = part('conveyor', 0, .5, { width: 5, name: '컨베이어' });
    const m = part('motor', -3.4, .5, { rpm: 65, maxTorque: 20, name: '컨베이어 모터' });
    const box = part('box', -1.5, -.15, { width: .55, height: .55, mass: 1, color: 'amber', name: '운반 상자', friction: .8 });
    const sensor = part('sensor', 1.5, -.1, { sensorMode: 'contact', threshold: .5, target: box.id, name: '접촉 센서' });
    const timer = part('timer', -2.3, 2.4, { period: 8, name: '주기 타이머' });
    const gate = part('not', -.1, 2.4, { name: '센서 반전' });
    const and = part('and', 1.7, 2.4, { name: '운전 조건' });
    return project('자동화 컨베이어', '타이머가 켜져 있고 접촉 센서가 비어 있으면 모터를 가동합니다. 보라색 점선은 제어 신호입니다. 상자를 드래그해 센서에서 치우면 다시 가동합니다.', [belt,m,box,sensor,timer,gate,and], [link('belt',m.id,belt.id,{tension:80}),link('signal',sensor.id,gate.id),link('signal',gate.id,and.id),link('signal',timer.id,and.id),link('signal',and.id,m.id)], true);
  } },
  { id: 'fourbar', name: '4절 링크 장치', subtitle: 'Closed-loop rigid linkage', category: '운동 변환', build: () => {
    const a = part('crank', -1.3, 0, { radius: .65, angle: -.6, name: '입력 크랭크', motorEnabled: true, rpm: 35, maxTorque: 8, color: 'mint' });
    const b = part('crank', 1.3, 0, { radius: 1.6, name: '종동 로커' });
    const A = localToWorld(a, {x: a.radius*.72,y:0});
    const dx = b.x-A.x, dy = b.y-A.y, d = Math.hypot(dx,dy), l = 2.2, r = b.radius*.72;
    const q = (l*l-r*r+d*d)/(2*d), h = Math.sqrt(l*l-q*q);
    const B = {x:A.x+q*dx/d+h*dy/d,y:A.y+q*dy/d-h*dx/d};
    b.angle = Math.atan2(B.y-b.y,B.x-b.x);
    const rod = part('rod',(A.x+B.x)/2,(A.y+B.y)/2,{width:l,angle:Math.atan2(B.y-A.y,B.x-A.x),name:'커플러'});
    return project('4절 링크 장치','두 고정 회전축과 세 개의 강체를 실제 회전 관절로 연결한 폐회로 링크입니다. 로커는 일정 속도 회전 대신 왕복 각운동을 합니다.',[a,b,rod],[link('hinge',a.id,rod.id,{portA:{x:a.radius*.72,y:0},portB:{x:-l/2,y:0}}),link('hinge',rod.id,b.id,{portA:{x:l/2,y:0},portB:{x:b.radius*.72,y:0}})]);
  } },
  { id: 'automation', name: '복합 자동화 기계', subtitle: 'Gears · piston · sensor · control', category: '자동화', build: () => {
    const p = crankMachine(true);
    const sw = part('switch', -3.5, 2.3, { name: '메인 스위치' });
    const timer = part('timer', -1.7, 2.3, { period: 5, name: '운전 타이머' });
    const and = part('and', .1, 2.3, { name: '운전 AND' });
    const sensor = part('sensor', 2, -1.4, { sensorMode:'position',target:p.parts.find(i=>i.kind==='piston')!.id,threshold:1.5,name:'피스톤 위치 센서' });
    const controller = part('controller', 2.1, 2.3, { name: '모터 제어기' });
    p.parts.push(sw,timer,and,sensor,controller);
    p.connections.push(link('signal',sw.id,and.id),link('signal',timer.id,and.id),link('signal',and.id,controller.id),link('signal',controller.id,p.parts[0].id));
    p.description += ' 스위치와 타이머를 AND 게이트로 연결하여 주기적으로 구동하며 위치 센서의 상태를 관찰할 수 있습니다.';
    return p;
  } },
];
export const defaultProject = () => EXAMPLES[0].build();
