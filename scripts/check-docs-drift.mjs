#!/usr/bin/env node
// PR-only drift guard. Does not modify documentation or push to any branch.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const required=['.claude/pipeline/project-doc.md','AGENTS.md'];
for (const f of required) if (!existsSync(f)) { console.error('Docs: ausente '+f); process.exitCode=1; }
const map=existsSync(required[0])?readFileSync(required[0],'utf8'):'';
for(const marker of ['## Data Architecture','## Cross-Cutting Concerns','## Entry Points']) if (!map.includes(marker)){
 console.error('Docs: mapa incompleto: '+marker);process.exitCode=1;
}
const base=process.env.GITHUB_BASE_REF;
if (base){
 try {
  const diff=execFileSync('git',['diff','--name-only','origin/'+base+'...HEAD'],{encoding:'utf8'}).trim().split('\n');
  const core=diff.some(p=>/^(lib\/db\/schema\.ts|lib\/auth\.ts|lib\/project-access\.ts|app\/api\/cliente\/)/.test(p));
  const docChanged=diff.some(p=>p==='.claude/pipeline/project-doc.md'||p==='AGENTS.md');
  if(core&&!docChanged){console.error('Docs: mudanças de auth/tenant sem mapa de arquitetura atualizado no PR.');process.exitCode=1;}
 }catch(err){console.warn('Docs: não foi possível calcular diff do PR:',err.message)}
}
if(!process.exitCode)console.log('Docs: scan e rastreabilidade do PR OK.');
