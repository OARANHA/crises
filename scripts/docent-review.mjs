#!/usr/bin/env node
// VigiaElus adaptation of the Docent workflow: review only, never auto-stage or push docs.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
function git(...args) { return execFileSync('git', args, { cwd:root, encoding:'utf8' }).trim(); }
const changed = git('diff','--cached','--name-only','--diff-filter=ACMRT').split('\n').filter(Boolean);
const relevant = changed.filter(p=>/^(app|lib|components|scripts|tests|\.github)\//.test(p));
if (!relevant.length) process.exit(0);
const docsChanged = changed.filter(p=>/^(README\.md|AGENTS\.md|\.env\.example|docs\/|\.claude\/pipeline\/)/.test(p));
const msg = '# Docent — proposta de documentação (pre-commit)\n\nArquivos de código alterados:\n' + relevant.map(p=>'- '+p).join('\n')
 + '\n\nDocumentação já incluída no commit:\n' + (docsChanged.map(p=>'- '+p).join('\n')||'- Nenhuma')
 + '\n\nRevisar: README.md, .env.example, docs/ e .claude/pipeline/project-doc.md. Nenhuma alteração é aplicada automaticamente.\n';
const outfile = join(root,'.git','docent-review.md');
writeFileSync(outfile,msg,'utf8');
console.log('Docent: relatório local em .git/docent-review.md; não altera arquivos versionados.');
if (process.env.DOCENT_AI !== '1') {
  console.log('Docent AI opcional: ative com DOCENT_AI=1 quando o Claude CLI estiver autenticado.');
  process.exit(0);
}
// AI review is opt-in; do not transmit staged secrets (dotenv, key files, binary files).
const diff = git('diff','--cached','--','app','lib','components','scripts','tests','.github').slice(0,24000);
if (/(?:PRIVATE KEY-----|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,})/.test(diff)) {
  console.error('Docent: possível segredo no diff; revisão remota cancelada.');
  process.exit(1);
}
const prompt = 'Revisor Docent do VigiaElus. Examine o diff fornecido e PROPOR apenas atualizações em README, .env.example, .claude/pipeline/project-doc.md ou docs/. Não execute comandos, não mude arquivos, não invente funcionalidades nem métricas. Responda em português com recomendações objetivas. DIFF:\n'+diff;
const res = spawnSync('claude',['-p','--permission-mode','plan',prompt],{
  cwd:root,encoding:'utf8',timeout:45000,shell:false,maxBuffer:1024*1024,
});
if (res.status===0 && res.stdout?.trim()) {
  writeFileSync(outfile,msg+'\n## Recomendações do Claude\n\n'+res.stdout.trim()+'\n','utf8');
} else console.warn('Docent: revisão Claude indisponível. Relatório determinístico preservado.');
process.exit(0);
