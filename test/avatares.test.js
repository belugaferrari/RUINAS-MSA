import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATARES, GRUPOS_AVATAR, svgAvatar } from '../shared/avatares.js';

test('avatares prontos: ~100, ids únicos, todos os grupos e SVG sem valores quebrados', () => {
  assert.ok(AVATARES.length >= 100);
  assert.equal(new Set(AVATARES.map(a => a.id)).size, AVATARES.length);
  for (const [g] of GRUPOS_AVATAR) assert.ok(AVATARES.some(a => a.grupo === g), `grupo sem avatar: ${g}`);
  for (const a of AVATARES) {
    const s = svgAvatar(a);
    assert.match(s, /^<svg [^>]*viewBox="0 0 128 128"/);
    assert.doesNotMatch(s, /NaN|undefined/, a.id);
  }
  assert.ok(AVATARES.some(a => a.genero === 'feminino') && AVATARES.some(a => a.genero === 'masculino'));
});
