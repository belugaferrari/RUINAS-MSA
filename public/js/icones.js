// Ícones (Lucide, licença ISC). O servidor monta /icones.svg só com os nomes desta lista,
// então todo ícone novo precisa ser adicionado aqui.
export const ICONES = [
  'sliders-horizontal',
  'utensils-crossed', 'cup-soda', 'bed', 'biohazard', 'thermometer-snowflake', 'battery-low', 'battery-warning', 'activity', 'droplet', 'bandage', 'syringe', 'hand', 'footprints', 'arrow-down-to-line', 'stars', 'tornado', 'link', 'moon-star', 'circle-help', 'brain-circuit', 'heart-crack', 'frown', 'laugh', 'repeat', 'meh', 'annoyed', 'angry', 'shield-alert', 'dna',
  'anchor', 'arrow-left', 'battery-charging', 'box', 'car', 'cpu', 'pill', 'utensils', 'wrench', 'arrow-left-right', 'flag', 'axe', 'backpack', 'book', 'book-open', 'bookmark', 'brain', 'camera', 'castle', 'check',
  'chevron-down', 'chevron-up', 'circle-alert', 'coins', 'compass', 'copy', 'crosshair', 'crown', 'dice-5', 'dices',
  'door-closed', 'door-open', 'download', 'drama', 'eye', 'eye-off', 'feather', 'file-spreadsheet', 'flame', 'gem',
  'ghost', 'hand-heart', 'heart', 'heart-pulse', 'hourglass', 'image', 'info', 'landmark', 'library', 'lock',
  'lock-open', 'log-out', 'map', 'menu', 'minus', 'network', 'notebook-pen', 'pencil', 'play', 'plus', 'refresh-cw', 'save',
  'scale', 'scroll', 'search', 'settings', 'shield', 'shirt', 'ship', 'skip-forward', 'skull', 'smile', 'sparkles', 'store', 'square-x', 'sword', 'swords', 'tag',
  'target', 'trash-2', 'trending-up', 'upload', 'user', 'user-plus', 'user-round-x', 'users', 'wand-sparkles', 'wifi-off', 'x', 'zap',
];

const NS = 'http://www.w3.org/2000/svg';

export function icone(nome, classe = '') {
  if (!ICONES.includes(nome)) console.warn(`Ícone fora da lista: ${nome}`);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `ic ${classe}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `/icones.svg#${nome}`);
  svg.append(use);
  return svg;
}
