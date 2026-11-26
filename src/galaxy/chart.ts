import type { SharedStop, StopType } from '../rooms/map-types';

export const escapeMarkup = (value: unknown) => String(value ?? '')
  .replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

const categoryArt: Record<StopType, string> = {
  planet: 'planet', ship: 'player', station: 'station', point: 'star', system: 'planet', star: 'star',
};
const categorySymbols: Record<StopType, string> = {
  planet: '●', ship: '▲', station: '◇', point: '✦', system: '◎', star: '☀',
};
const illustratedRadii: Record<StopType, number> = { planet: 52, star: 43, ship: 40, station: 30, system: 40, point: 21 };

function art(name: string, x: number, y: number, width: number, height: number, cssClass: string, failed: Set<string>) {
  const url = new URL(`art/${name}.webp`, document.baseURI).href;
  if (failed.has(url)) return '';
  return `<image class="${cssClass}" data-art="${escapeMarkup(url)}" href="${escapeMarkup(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${cssClass === 'map-scenery' ? 'xMidYMid slice' : 'xMidYMid meet'}" pointer-events="none" aria-hidden="true"/>`;
}

export function chartBackdrop(image: string, failed: Set<string>) {
  return `<defs><pattern id="stars" width="83" height="73" patternUnits="userSpaceOnUse"><circle cx="12" cy="18" r="1" fill="#91a4ca"/><circle cx="65" cy="53" r=".6" fill="#bba6ff"/></pattern></defs><rect width="900" height="500" fill="url(#stars)"/>${
    image ? `<image id="map-background" href="${escapeMarkup(image)}" x="0" y="0" width="900" height="500" preserveAspectRatio="xMidYMid meet" pointer-events="none" aria-hidden="true"/>`
      : art('space', 0, 0, 900, 500, 'map-scenery', failed)}`;
}

interface ChartStopOptions {
  failed: Set<string>;
  illustrated: boolean;
  selected: boolean;
  actionable: boolean;
  reference?: boolean;
  current?: boolean;
  label?: string;
  elementId?: string;
}

export function chartStop({ id, name, x, y, type = 'point' }: SharedStop, options: ChartStopOptions) {
  const { failed, illustrated, selected, actionable, reference, current, label, elementId } = options;
  const radius = illustrated ? illustratedRadii[type] : 23;
  return `<g class="destination node-${type}${reference ? ' reference-marker' : ''}${selected ? ' selected' : ''}${actionable ? '' : ' unavailable-stop'}" data-destination="${escapeMarkup(id)}"${elementId ? ` id="${escapeMarkup(elementId)}"` : ''} tabindex="${actionable ? '0' : '-1'}" role="button"${actionable ? '' : ' aria-disabled="true"'} aria-pressed="${selected}" aria-label="${escapeMarkup(label ?? `Select ${name}${reference ? ' — reference only' : ''}${current ? ' — current location' : ''}`)}"><circle cx="${x}" cy="${y}" r="${radius}"/><text x="${x}" y="${y+5}" class="node-symbol">${categorySymbols[type]}</text>${!illustrated ? art(categoryArt[type], x-21, y-21, 42, 42, 'destination-art', failed) : ''}${selected ? `<path class="selection-brackets" d="M${x-29} ${y-17}v-12h12 M${x+17} ${y-29}h12v12 M${x+29} ${y+17}v12h-12 M${x-17} ${y+29}h-12v-12"/>` : ''}<text x="${x}" y="${y+(illustrated ? radius + ({ planet: 21, star: 21, ship: 21, station: 21, system: 21, point: 23 })[type] : 44)}" class="node-label">${escapeMarkup(name)}</text></g>`;
}

export function bindChartArt(root: ParentNode, failed: Set<string>) {
  root.querySelectorAll<SVGImageElement>('[data-art]').forEach(image => {
    image.addEventListener('load', () => image.closest('.destination')?.classList.add('art-loaded'));
    image.addEventListener('error', () => {
      failed.add(image.dataset.art!);
      image.closest('.destination')?.classList.remove('art-loaded');
      image.remove();
    });
  });
}
