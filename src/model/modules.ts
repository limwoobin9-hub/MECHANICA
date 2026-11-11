import { type UserModule, type Project, type Vec, type Part, type Connection, uid, clone } from './types';
export function extractModule(project:Project, ids:string[], name:string):UserModule {
  const selected=new Set(ids),parts=clone(project.parts.filter(p=>selected.has(p.id)));
  if(!parts.length)throw new Error('저장할 부품을 선택하세요.');
  const cx=parts.reduce((s,p)=>s+p.x,0)/parts.length,cy=parts.reduce((s,p)=>s+p.y,0)/parts.length;
  for(const p of parts){p.x-=cx;p.y-=cy;if(p.target&&!selected.has(p.target))p.target='';}
  const connections=clone(project.connections.filter(c=>selected.has(c.a)&&selected.has(c.b)));
  const ports:UserModule['ports']=[];
  for(const c of project.connections){if(selected.has(c.a)!==selected.has(c.b))ports.push({partId:selected.has(c.a)?c.a:c.b,point:clone(selected.has(c.a)?c.portA:c.portB),kind:c.kind});}
  return{id:uid(),name,parts,connections,ports};
}
export function instantiateModule(module:UserModule, point:Vec):{parts:Part[];connections:Connection[]} {
  const mapping=new Map(module.parts.map(p=>[p.id,uid()])),group=uid();
  const parts=clone(module.parts).map(p=>{
    const old=p.id;p.id=mapping.get(old)!;p.x+=point.x;p.y+=point.y;p.group=group;
    p.target=mapping.get(p.target)??'';
    p.customPorts=[...p.customPorts,...module.ports.filter(port=>port.partId===old).map(port=>clone(port.point))].slice(0,30);
    return p;
  });
  const connections=clone(module.connections).map(c=>({...c,id:uid(),a:mapping.get(c.a)!,b:mapping.get(c.b)!}));
  return{parts,connections};
}
