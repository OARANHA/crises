import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gdelt } from '../lib/connectors/gdelt';
const q = { anyTerms: ['CRF-RS'], allTerms: [], excludeTerms: [], languages: ['pt'], countries: ['BR'] };
test('GDELT 400 nao repete requisicao invalida', async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response('bad query', { status: 400 }); };
  try {
    await assert.rejects(gdelt.fetchMentions(q), /HTTP 400/);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = original; }
});
test('GDELT 429 limita repeticao e informa falha', async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response('rate limit', { status: 429 }); };
  try {
    await assert.rejects(gdelt.fetchMentions(q), /HTTP 429 do GDELT/);
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = original; }
});
