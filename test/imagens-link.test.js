import test from 'node:test';
import assert from 'node:assert/strict';
import { imagemDeLink } from '../shared/imagens.js';

test('link do Google Drive vira o endereço da imagem', () => {
  const id = '1AbCdEfGhIjKlMnOp_qrs-TUV';
  const esperado = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  assert.equal(imagemDeLink(`https://drive.google.com/file/d/${id}/view?usp=sharing`), esperado);
  assert.equal(imagemDeLink(`https://drive.google.com/open?id=${id}`), esperado);
  assert.equal(imagemDeLink(`https://drive.google.com/uc?export=view&id=${id}`), esperado);
  assert.equal(imagemDeLink('https://exemplo.com/rino.webp'), 'https://exemplo.com/rino.webp');
  assert.equal(imagemDeLink('rino.png'), null);
  assert.equal(imagemDeLink(''), null);
});
