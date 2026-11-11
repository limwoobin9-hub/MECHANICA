import { openDB, type DBSchema } from 'idb';
import { type Project, type UserModule, parseProject } from '../model/types';
interface MechanicaDB extends DBSchema {
  projects:{key:string;value:Project};
  modules:{key:string;value:UserModule};
  meta:{key:string;value:string};
}
let database:ReturnType<typeof openDB<MechanicaDB>>|undefined;
const db=()=>database??=openDB<MechanicaDB>('mechanica-workbench',1,{upgrade(db){db.createObjectStore('projects',{keyPath:'id'});db.createObjectStore('modules',{keyPath:'id'});db.createObjectStore('meta');}});
export async function saveProject(project:Project){const p=parseProject(project),d=await db();const tx=d.transaction(['projects','meta'],'readwrite');await tx.objectStore('projects').put(p);await tx.objectStore('meta').put(p.id,'last');await tx.done;}
export async function listProjects(){return(await(await db()).getAll('projects')).sort((a,b)=>b.modified-a.modified);}
export async function loadLastProject(){const d=await db(),id=await d.get('meta','last');const p=id?await d.get('projects',id):undefined;return p?parseProject(p):undefined;}
export async function removeProject(id:string){await(await db()).delete('projects',id);}
export async function saveModule(module:UserModule){await(await db()).put('modules',module);}
export async function listModules(){return(await(await db()).getAll('modules'));}
export async function removeModule(id:string){await(await db()).delete('modules',id);}
export function downloadJSON(project:Project){const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^\p{L}\p{N}\s_-]/gu,'').slice(0,70)||'mechanica'}.mechanica.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readProjectFile(file:File){if(file.size>5*1024*1024)throw new Error('프로젝트 파일은 5 MB 이하만 불러올 수 있습니다.');return parseProject(JSON.parse(await file.text()));}
