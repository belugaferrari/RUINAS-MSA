// npm run modelo → grava modelos/modelo_npcs.xlsx a partir de conteudo/sistema.json
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './db.js';
import { modeloNpcs } from './excel.js';

const destino = path.join(RAIZ, 'modelos', 'modelo_npcs.xlsx');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, Buffer.from(await modeloNpcs()));
console.log(`Modelo salvo em ${destino}`);
