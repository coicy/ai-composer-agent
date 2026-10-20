import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packages = {
  '@ai-composer/music-core': [],
  '@ai-composer/piano-roll': ['@ai-composer/music-core'],
  '@ai-composer/audio-engine': ['@ai-composer/music-core'],
  '@ai-composer/midi-io': ['@ai-composer/music-core'],
  '@ai-composer/composition': ['@ai-composer/music-core'],
  '@ai-composer/web': ['@ai-composer/music-core','@ai-composer/piano-roll','@ai-composer/audio-engine','@ai-composer/midi-io','@ai-composer/composition'],
  '@ai-composer/agent-api': ['@ai-composer/music-core','@ai-composer/composition']
};
const roots = new Map([
  ['@ai-composer/music-core','packages/music-core'],
  ['@ai-composer/piano-roll','packages/piano-roll'],
  ['@ai-composer/audio-engine','packages/audio-engine'],
  ['@ai-composer/midi-io','packages/midi-io'],
  ['@ai-composer/composition','packages/composition'],
  ['@ai-composer/web','apps/web'],
  ['@ai-composer/agent-api','services/agent-api']
]);
const errors = [];
function walk(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p,{withFileTypes:true}).flatMap(e=>{
    const f=join(p,e.name);
    return e.isDirectory()?walk(f):/\.[cm]?[jt]sx?$/.test(e.name)?[f]:[];
  });
}
for(const [name,dir] of roots){
  for(const filename of walk(join(root,dir,'src'))){
    const code=readFileSync(filename,'utf8');
    const importRx=/(?:\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g;
    for(const m of code.matchAll(importRx)){
      const target=m[1];
      if(!target)continue;
      const foreign=Object.keys(packages).find(pkg=>target===pkg||target.startsWith(pkg+'/'));
      if(foreign){
        if(foreign!==name&&!packages[name].includes(foreign))errors.push(`${relative(root,filename)} cannot depend on ${foreign}`);
        if(target!==foreign)errors.push(`${relative(root,filename)} deep import ${target} forbidden`);
      }
      if(target.startsWith('.')){
        const abs=resolve(filename,'..',target);
        const own=resolve(root,dir);
        if(abs!==own&&!abs.startsWith(own+sep))errors.push(`${relative(root,filename)} relative import escapes package: ${target}`);
      }
    }
    if(name==='@ai-composer/music-core'&&/from\s*['"](?:react|tone|@tonejs\/|node:)/.test(code))
      errors.push(`${relative(root,filename)} forbidden domain dependency`);
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('Architecture import boundaries passed.');
