import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const { EXAMPLES }=await server.ssrLoadModule('/src/model/examples.ts');
  await mkdir('examples',{recursive:true});
  for(const example of EXAMPLES)await writeFile(`examples/${example.id}.mechanica.json`,JSON.stringify(example.build(),null,2)+'\n');
  console.log(`Exported ${EXAMPLES.length} editable examples.`);
} finally {await server.close();}
