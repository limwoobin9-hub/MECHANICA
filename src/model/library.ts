import { type Part, type PartKind, type Category, type Connection, type ConnectionKind, type Vec, uid } from './types';
export interface LibraryItem { kind: PartKind | 'spring-kit' | 'damper-kit' | 'hinge-tool' | 'rope-tool' | 'clutch-tool'; name: string; english: string; category: Category; description: string }
export const LIBRARY: LibraryItem[] = [
  { kind: 'gear', name: '평기어', english: 'Spur gear', category: 'transmission', description: '피치와 중심거리를 검증하는 강체 기어' },
  { kind: 'pulley', name: '풀리', english: 'Belt pulley', category: 'transmission', description: '장력과 마찰로 구동되는 벨트 풀리' },
  { kind: 'rack', name: '랙 기어', english: 'Rack & pinion', category: 'transmission', description: '피니언 회전을 직선 운동으로 변환' },
  { kind: 'flywheel', name: '플라이휠', english: 'Flywheel', category: 'transmission', description: '관성을 이용한 에너지 저장' },
  { kind: 'crank', name: '크랭크', english: 'Crankshaft', category: 'transmission', description: '편심 핀을 가진 회전축' },
  { kind: 'rod', name: '연결봉', english: 'Connecting rod', category: 'transmission', description: '양 끝에 관절을 연결하는 강체' },
  { kind: 'piston', name: '피스톤', english: 'Piston & cylinder', category: 'transmission', description: '실린더 축을 따라 움직이는 슬라이더' },
  { kind: 'cam', name: '편심 캠', english: 'Eccentric cam', category: 'transmission', description: '실제 충돌로 팔로어를 밀어 올리는 캠' },
  { kind: 'follower', name: '캠 팔로어', english: 'Cam follower', category: 'transmission', description: '레일 위에서 캠과 접촉하는 롤러' },
  { kind: 'ratchet', name: '래칫', english: 'One-way ratchet', category: 'transmission', description: '역회전을 구속하는 일방향 축' },
  { kind: 'clutch-tool', name: '클러치', english: 'Friction clutch', category: 'transmission', description: '토크 한계가 있는 두 축의 마찰 연결' },
  { kind: 'rope-tool', name: '로프 · 와이어', english: 'Tension link', category: 'transmission', description: '최대 길이만 제한하는 인장 연결' },
  { kind: 'frame', name: '고정 프레임', english: 'Fixed frame', category: 'structure', description: '움직이지 않는 구조물' },
  { kind: 'box', name: '사각 강체', english: 'Rigid body', category: 'structure', description: '질량과 충돌을 가진 자유 강체' },
  { kind: 'disc', name: '원형 강체', english: 'Circular body', category: 'structure', description: '충돌과 회전이 가능한 원형 물체' },
  { kind: 'bearing', name: '베어링 · 축', english: 'Bearing', category: 'structure', description: '중심을 고정하고 회전만 허용하는 축' },
  { kind: 'hinge-tool', name: '힌지 · 관절', english: 'Revolute joint', category: 'structure', description: '두 연결점을 회전 관절로 연결' },
  { kind: 'spring-kit', name: '스프링', english: 'Spring & mass', category: 'structure', description: '스프링 상수와 감쇠를 갖는 진동계' },
  { kind: 'damper-kit', name: '완충 장치', english: 'Suspension', category: 'structure', description: '스프링과 댐퍼를 조합한 서스펜션' },
  { kind: 'motor', name: '회전 모터', english: 'Torque-limited motor', category: 'power', description: '목표 RPM과 최대 토크를 갖는 구동기' },
  { kind: 'actuator', name: '선형 액추에이터', english: 'Linear actuator', category: 'power', description: '최대 힘이 제한되는 직선 구동기' },
  { kind: 'force', name: '힘 발생기', english: 'Linear force', category: 'power', description: '슬라이더에 일정한 힘을 가하는 장치' },
  { kind: 'torque', name: '토크 발생기', english: 'Torque source', category: 'power', description: '회전축에 일정 토크를 가하는 장치' },
  { kind: 'brake', name: '브레이크', english: 'Shaft brake', category: 'power', description: '제한 토크로 회전을 제동' },
  { kind: 'conveyor', name: '컨베이어', english: 'Conveyor belt', category: 'power', description: '구동축의 속도로 접촉한 물체를 운반' },
  { kind: 'switch', name: '스위치', english: 'Toggle switch', category: 'control', description: '유지되는 ON/OFF 제어 신호' },
  { kind: 'button', name: '버튼', english: 'Push button', category: 'control', description: '누르는 동안 켜지는 입력' },
  { kind: 'timer', name: '타이머', english: 'Pulse timer', category: 'control', description: '설정 주기의 절반 동안 ON인 신호' },
  { kind: 'delay', name: '지연 회로', english: 'On-delay', category: 'control', description: '입력이 유지된 뒤 지연하여 켜지는 회로' },
  { kind: 'sensor', name: '센서', english: 'Speed / position / contact', category: 'control', description: '속도·위치·접촉을 측정하는 제어 입력' },
  { kind: 'and', name: 'AND 게이트', english: 'Logic AND', category: 'control', description: '모든 입력이 ON일 때 동작' },
  { kind: 'or', name: 'OR 게이트', english: 'Logic OR', category: 'control', description: '하나 이상의 입력이 ON일 때 동작' },
  { kind: 'not', name: 'NOT 게이트', english: 'Logic NOT', category: 'control', description: '첫 입력을 반전' },
  { kind: 'controller', name: '모터 제어기', english: 'Motor controller', category: 'control', description: '입력 신호로 구동기를 제어' },
];
export const KIND_NAMES = Object.fromEntries(LIBRARY.map(i => [i.kind, i.name])) as Record<PartKind, string>;
export const CONNECTION_NAMES: Record<ConnectionKind, string> = { gear: '기어 맞물림', belt: '개방 벨트', crossed: '교차 벨트', shaft: '동축 연결', hinge: '회전 관절', weld: '고정 연결', spring: '스프링 · 댐퍼', rope: '로프 · 와이어', rack: '랙 & 피니언', clutch: '마찰 클러치', signal: '제어 신호' };
export function makePart(kind: PartKind, x = 0, y = 0, overrides: Partial<Part> = {}): Part {
  const p: Part = { id: uid(), kind, name: KIND_NAMES[kind] ?? kind, x, y, angle: 0,
    width: 1.2, height: .65, radius: .6, mass: 2, friction: .35, restitution: .05, damping: .025,
    teeth: 24, module: .05, mounted: ['gear','pulley','motor','crank','flywheel','bearing','torque','brake','cam','ratchet','conveyor'].includes(kind),
    motorEnabled: kind === 'motor', enabled: !['button'].includes(kind), rpm: 120, maxTorque: 12, load: 0, efficiency: .9,
    force: 10, velocity: 0, angularVelocity: 0, travel: 6, threshold: 60, period: 2,
    sensorMode: 'speed', target: '', color: 'silver', group: '', customPorts: [], ...overrides };
  if (kind === 'rod') Object.assign(p, { width: 2, height: .18, mass: .5, ...overrides });
  if (kind === 'frame') Object.assign(p, { width: 3, height: .25, ...overrides });
  if (kind === 'motor') Object.assign(p, { radius: .32, color: 'mint', ...overrides });
  if (kind === 'piston' || kind === 'actuator' || kind === 'force') Object.assign(p, { width: .85, height: .65, mass: 1, ...overrides });
  if (kind === 'rack') Object.assign(p, { width: 3, height: .25, mass: 1.5, ...overrides });
  if (kind === 'flywheel') Object.assign(p, { mass: 8, radius: .8, ...overrides });
  if (kind === 'cam') Object.assign(p, { radius: .7, ...overrides });
  if (kind === 'follower') Object.assign(p, { width: .4, height: .4, radius: .2, angle: Math.PI/2, ...overrides });
  if (kind === 'conveyor') Object.assign(p, { width: 4.4, height: .6, radius: .3, mass: 8, color: 'blue', ...overrides });
  return p;
}
export function makeConnection(kind: ConnectionKind, a: string, b: string, options: Partial<Connection> = {}): Connection {
  return { id: uid(), kind, a, b, portA: { x: 0, y: 0 }, portB: { x: 0, y: 0 }, stiffness: 50, damping: 2, restLength: 0, tension: 40, friction: .6, enabled: true, ...options };
}
export const springKit = (point: Vec, damped = false) => {
  const frame = makePart('frame', point.x, point.y - 1.4, { width: 1.4 });
  const mass = makePart('box', point.x, point.y + 1.2, { width: .7, height: .7, name: '진동 질량', mass: 2 });
  return { parts: [frame, mass], connections: [makeConnection('spring', frame.id, mass.id, { restLength: 1.6, stiffness: 40, damping: damped ? 6 : .3 })] };
};
