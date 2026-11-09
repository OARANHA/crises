import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_PROVIDERS, customChatUrl } from '../lib/ai-provider';

test('provedor OpenAI compatível está registrado sem modelo ou preço fictício', () => {
  const def = AI_PROVIDERS.custom;
  assert.equal(def.keyEnv, 'CUSTOM_OPENAI_API_KEY');
  assert.equal(def.endpointEnv, 'CUSTOM_OPENAI_ENDPOINT');
  assert.equal(def.models.fast, '');
  assert.equal(def.models.smart, '');
  assert.equal(def.defaultPrice.input, 0);
});

test('normaliza uma URL HTTPS pública e preserva o caminho da API', () => {
  const env = { NODE_ENV: 'development' };
  assert.equal(customChatUrl('https://api.provedor.com/v1', env),
    'https://api.provedor.com/v1/chat/completions');
  assert.equal(customChatUrl('https://api.provedor.com/v1/chat/completions', env),
    'https://api.provedor.com/v1/chat/completions');
  assert.equal(customChatUrl('https://api.provedor.com', env),
    'https://api.provedor.com/chat/completions');
});

test('bloqueia HTTP, rede local, IP literal, porta, usuário e query', () => {
  const env = { NODE_ENV: 'development' };
  for (const value of [
    'http://api.provedor.com/v1',
    'https://localhost/v1', 'https://foo.local/v1', 'https://db.internal/v1',
    'https://127.0.0.1/v1', 'https://10.0.0.1/v1', 'https://[::1]/v1',
    'https://api.provedor.com:8443/v1', 'https://user:pass@api.provedor.com/v1',
    'https://api.provedor.com/v1?token=abc', 'https://api.provedor.com/v1#frag',
  ]) {
    assert.throws(() => customChatUrl(value, env), Error, value);
  }
});

test('em produção o hostname deve constar da allowlist do operador', () => {
  const env = { NODE_ENV: 'production', AI_COMPAT_ALLOWED_HOSTS: 'api.provedor.com' };
  assert.equal(customChatUrl('https://api.provedor.com/v1', env),
    'https://api.provedor.com/v1/chat/completions');
  assert.throws(() => customChatUrl('https://api.outro.com/v1', env), /AI_COMPAT_ALLOWED_HOSTS/);
  assert.throws(() => customChatUrl('https://api.provedor.com/v1', { NODE_ENV: 'production' }),
    /AI_COMPAT_ALLOWED_HOSTS/);
});

test('o portal do cliente não usa classificações sintéticas', () => {
  const page = readFileSync(new URL('../app/cliente/page.tsx', import.meta.url), 'utf8');
  const portal = readFileSync(new URL('../lib/client-portal.ts', import.meta.url), 'utf8');
  assert.match(page, /Publicações negativas/);
  assert.match(page, /Último resumo disponível/);
  assert.match(page, /ausência de riscos/);
  assert.match(portal, /eq\(mentions\.projectId, projectId\)/);
  assert.match(portal, /inArray\(mentions\.sentiment/);
});

test('abas e páginas de configurações estão em português', () => {
  const tabs = readFileSync(new URL('../components/settings-tabs.tsx', import.meta.url), 'utf8');
  const sources = readFileSync(new URL('../app/impostazioni/fonti/page.tsx', import.meta.url), 'utf8');
  const budget = readFileSync(new URL('../app/impostazioni/budget/page.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /Minha conta/);
  assert.match(tabs, /Créditos e termos/);
  assert.match(sources, /Fontes de monitoramento/);
  assert.match(budget, /Orçamento e custos/);
  assert.doesNotMatch(sources, /Source status/);
  assert.doesNotMatch(budget, /Paid data sources/);
});
