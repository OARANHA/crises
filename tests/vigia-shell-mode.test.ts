import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveShellMode } from '../lib/shell-mode';

test('entrada e landing usam layout publico quando nao autenticados', () => {
  assert.equal(resolveShellMode(null, false), 'public');
  assert.equal(resolveShellMode(undefined, false), 'public');
});

test('cliente tem shell exclusivo; dono/admin e membros tem workspace', () => {
  assert.equal(resolveShellMode('client', false), 'client');
  assert.equal(resolveShellMode('admin', false), 'workspace');
  assert.equal(resolveShellMode('member', false), 'workspace');
});

test('modo demonstracao preserva shell do dashboard', () => {
  assert.equal(resolveShellMode(null, true), 'workspace');
});

test('portal tem fallback de texto UTF-8 correto', () => {
  const source = readFileSync(new URL('../lib/client-portal.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/Publicação sem título/g) ?? []).length, 2);
  assert.doesNotMatch(source, /PublicaÃ/);
});

test('layout da aplicacao usa resolucao de shell e marca VigiaElus', () => {
  const source = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(source, /resolveShellMode\(user\?\.role, demo\)/);
  assert.match(source, /shellMode === 'public' \? children/);
  assert.match(source, /VigiaElus — Inteligência de reputação/);
  assert.doesNotMatch(source, /Scognamiglio1969\/radar-intelligence/);
});
