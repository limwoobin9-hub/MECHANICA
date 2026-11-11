import { z } from 'zod';

export const PART_KINDS = ['frame', 'box', 'disc', 'rod', 'gear', 'pulley', 'motor', 'crank', 'flywheel', 'piston', 'rack', 'bearing', 'actuator', 'force', 'torque', 'brake', 'cam', 'follower', 'ratchet', 'conveyor', 'switch', 'button', 'timer', 'delay', 'sensor', 'and', 'or', 'not', 'controller'] as const;
export const CONNECTION_KINDS = ['gear', 'belt', 'crossed', 'shaft', 'hinge', 'weld', 'spring', 'rope', 'rack', 'clutch', 'signal'] as const;
export type PartKind = typeof PART_KINDS[number];
export type ConnectionKind = typeof CONNECTION_KINDS[number];
export type Vec = { x: number; y: number };
export type Category = 'all' | 'structure' | 'transmission' | 'power' | 'control';
export const vectorSchema = z.object({ x: z.number().finite().min(-1000).max(1000), y: z.number().finite().min(-1000).max(1000) });
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
export const partSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(PART_KINDS), name: z.string().min(1).max(100),
  x: finite(-1000, 1000), y: finite(-1000, 1000), angle: finite(-100000, 100000),
  width: finite(.08, 30), height: finite(.08, 30), radius: finite(.04, 10),
  mass: finite(.01, 10000), friction: finite(0, 2), restitution: finite(0, 1), damping: finite(0, 20),
  teeth: finite(8, 160).int(), module: finite(.005, .2), mounted: z.boolean(),
  motorEnabled: z.boolean(), enabled: z.boolean(), rpm: finite(-3000, 3000), maxTorque: finite(0, 10000),
  load: finite(0, 10000), efficiency: finite(.01, 1), force: finite(-10000, 10000),
  velocity: finite(-100, 100), angularVelocity: finite(-1000, 1000),
  travel: finite(.1, 50), threshold: finite(-10000, 10000), period: finite(.05, 1000),
  sensorMode: z.enum(['speed', 'position', 'contact']), target: z.string().max(100),
  color: z.enum(['silver', 'mint', 'blue', 'amber']), group: z.string().max(100), customPorts: z.array(vectorSchema).max(30),
});
export type Part = z.infer<typeof partSchema>;
export const connectionSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(CONNECTION_KINDS),
  a: z.string().min(1).max(100), b: z.string().min(1).max(100),
  portA: vectorSchema, portB: vectorSchema,
  stiffness: finite(.1, 20000), damping: finite(0, 2000),
  restLength: finite(0, 100), tension: finite(0, 10000), friction: finite(0, 2), enabled: z.boolean(),
});
export type Connection = z.infer<typeof connectionSchema>;
export const settingsSchema = z.object({
  gravity: z.boolean(), gravityValue: finite(0, 50), snap: z.boolean(), gridSize: finite(.05, 2),
  rotationSnap: finite(1, 90), showConnections: z.boolean(), showVectors: z.boolean(),
  showLabels: z.boolean(), quality: z.enum(['high', 'balanced', 'fast']), speed: finite(.1, 4),
});
export type Settings = z.infer<typeof settingsSchema>;
export const projectSchema = z.object({
  format: z.literal('mechanica'), version: z.literal(1), id: z.string().min(1).max(100),
  name: z.string().min(1).max(150), description: z.string().max(4000),
  parts: z.array(partSchema).max(1500), connections: z.array(connectionSchema).max(4000),
  settings: settingsSchema, modified: finite(0, 100000000000000),
});
export type Project = z.infer<typeof projectSchema>;
export interface UserModule { id: string; name: string; parts: Part[]; connections: Connection[]; ports: { partId: string; point: Vec; kind: ConnectionKind }[] }
export type Mode = 'design' | 'running' | 'paused';
export type Tool = 'select' | 'pan' | 'connect';
export const DEFAULT_SETTINGS: Settings = { gravity: false, gravityValue: 9.81, snap: true, gridSize: .25, rotationSnap: 15, showConnections: true, showVectors: false, showLabels: true, quality: 'high', speed: 1 };
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const clone = <T,>(data: T): T => structuredClone(data);
export const ROTARY = new Set<PartKind>(['disc', 'gear', 'pulley', 'motor', 'crank', 'flywheel', 'bearing', 'torque', 'brake', 'cam', 'ratchet', 'conveyor']);
export const LINEAR = new Set<PartKind>(['piston', 'rack', 'actuator', 'follower', 'force']);
export const LOGIC = new Set<PartKind>(['switch', 'button', 'timer', 'delay', 'sensor', 'and', 'or', 'not', 'controller']);
export const isGear = (p: Part) => p.kind === 'gear' || p.kind === 'ratchet';
export const radiusOf = (p: Part) => isGear(p) ? p.teeth * p.module / 2 : p.radius;
export const inertiaOf = (p: Part) => p.mass * (ROTARY.has(p.kind) ? radiusOf(p) ** 2 / 2 : (p.width ** 2 + p.height ** 2) / 12);
export const localToWorld = (p: Pick<Part, 'x' | 'y' | 'angle'>, v: Vec): Vec => ({ x: p.x + v.x * Math.cos(p.angle) - v.y * Math.sin(p.angle), y: p.y + v.x * Math.sin(p.angle) + v.y * Math.cos(p.angle) });
export const worldToLocal = (p: Pick<Part, 'x' | 'y' | 'angle'>, v: Vec): Vec => ({ x: (v.x - p.x) * Math.cos(p.angle) + (v.y - p.y) * Math.sin(p.angle), y: -(v.x - p.x) * Math.sin(p.angle) + (v.y - p.y) * Math.cos(p.angle) });
export function portsOf(p: Part): Vec[] {
  if (LOGIC.has(p.kind)) return [{ x: 0, y: 0 }];
  if (ROTARY.has(p.kind)) return [{ x: 0, y: 0 }, { x: radiusOf(p) * .72, y: 0 }, ...p.customPorts];
  return [{ x: 0, y: 0 }, { x: -p.width / 2, y: 0 }, { x: p.width / 2, y: 0 }, ...p.customPorts];
}
export function parseProject(input: unknown): Project {
  const p = projectSchema.parse(input);
  const ids = new Set<string>();
  for (const part of p.parts) {
    if (ids.has(part.id)) throw new Error('중복된 부품 ID가 있습니다.');
    ids.add(part.id);
  }
  const connectionIds = new Set<string>();
  for (const c of p.connections) {
    if (connectionIds.has(c.id)) throw new Error('중복된 연결 ID가 있습니다.');
    connectionIds.add(c.id);
    if (!ids.has(c.a) || !ids.has(c.b) || c.a === c.b) throw new Error('연결 대상이 없거나 자기 자신에 연결되어 있습니다.');
  }
  for (const part of p.parts) if (part.target && !ids.has(part.target)) throw new Error('센서의 측정 대상이 없습니다.');
  return p;
}
