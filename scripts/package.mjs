import { zipSync } from 'fflate';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
// Include the reviewed application source, tests, docs and offline build only.
// Runtime data, credentials, node_modules, Git metadata and test downloads are excluded.
const entries={};
const roots=['src','tests','scripts','examples','docs','.github','public'];
const rootFiles=['README.md','.gitignore','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','playwright.config.ts','vercel.json'];
const timestamp=new Date('2026-01-01T00:00:00Z');
async function add(filename){
  if(path.basename(filename).startsWith('.env')||filename.endsWith('MECHANICA.zip'))return;
  entries['MECHANICA/'+filename.replaceAll(path.sep,'/')]=[new Uint8Array(await readFile(filename)),{mtime:timestamp}];
}
async function walk(folder){for(const item of await readdir(folder,{withFileTypes:true})){const filename=path.join(folder,item.name);if(item.isDirectory())await walk(filename);else if(item.isFile())await add(filename);}}
for(const root of roots)await walk(root);
for(const filename of rootFiles)await add(filename);
entries['MECHANICA/MECHANICA.html']=[new Uint8Array(await readFile('dist/index.html')),{mtime:timestamp}];
const archive=zipSync(entries,{level:6});
await writeFile('dist/MECHANICA.zip',archive);
console.log(`Packaged offline app + ${Object.keys(entries).length-1} source files: dist/MECHANICA.zip (${Math.round(archive.length/1024)} KiB)`);
