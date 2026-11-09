import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialAdminCredentials } from '../lib/db/admin-bootstrap';

test('P0: producao sem ADMIN_PASSWORD nao cria credenciais publicas', () => {
  assert.throws(
    () => initialAdminCredentials({ NODE_ENV: 'production' }),
    /ADMIN_PASSWORD is required/,
  );
  assert.throws(
    () => initialAdminCredentials({ NODE_ENV: 'production', ADMIN_PASSWORD: '   ' }),
    /ADMIN_PASSWORD is required/,
  );
  assert.throws(
    () => initialAdminCredentials({ NODE_ENV: 'production', ADMIN_PASSWORD: 'changeme' }),
    /ADMIN_PASSWORD is required/,
  );
});

test('P0: somente senha explicita suficientemente longa permite bootstrap em producao', () => {
  const admin = initialAdminCredentials({
    NODE_ENV: 'production',
    ADMIN_EMAIL: '  OWNER@EXAMPLE.COM  ',
    ADMIN_NAME: ' Gestor ',
    ADMIN_PASSWORD: 'senha-de-teste-exclusiva-2026',
  });
  assert.equal(admin.email, 'owner@example.com');
  assert.equal(admin.name, 'Gestor');
  assert.equal(admin.mustChange, 0);
  assert.equal(admin.password, 'senha-de-teste-exclusiva-2026');
});

test('P0: fallback legado de desenvolvimento exige troca no primeiro acesso', () => {
  const admin = initialAdminCredentials({ NODE_ENV: 'development' });
  assert.equal(admin.email, 'admin@example.com');
  assert.equal(admin.password, 'changeme');
  assert.equal(admin.mustChange, 1);
});

test('P0: coleta nao apaga automaticamente o historico de mencoes', () => {
  const pipeline = readFileSync(new URL('../lib/pipeline.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(pipeline, /\bDELETE\s+FROM\s+mentions\b/i);
  assert.match(pipeline, /Preservação de dados/);
});

test('P0: seed do banco utiliza a politica central de bootstrap', () => {
  const index = readFileSync(new URL('../lib/db/index.ts', import.meta.url), 'utf8');
  assert.match(index, /const a = initialAdminCredentials\(\)/);
  assert.doesNotMatch(index, /function seedAdmin\(/);
});
