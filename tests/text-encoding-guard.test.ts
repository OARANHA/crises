import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairUtf8Mojibake as fix } from '../lib/repair-utf8-mojibake';

test('repair UTF8 mojibake without changing correct text', () => {
  assert.equal(fix('PublicaÃ§Ã£o sem tÃ­tulo'), 'Publicação sem título');
  assert.equal(fix('MenÃ§Ãµes e AnÃ¡lises'), 'Menções e Análises');
  assert.equal(fix('ConfiguraÃ§Ãµes Â· Ãšltima atualizaÃ§Ã£o'), 'Configurações · Última atualização');
  assert.equal(fix('Notas â€” RevisÃ£o'), 'Notas — Revisão');
  assert.equal(fix('Publicação sem título'), 'Publicação sem título');
  assert.equal(fix('Âmbar e aço'), 'Âmbar e aço');
});