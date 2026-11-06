/** Ephemeral view state only: never enters a campaign export or browser save. */
export class MapViewState {
  private positions = new Map<string, number>();
  private renderedKey = '';

  capture(root: HTMLElement) {
    const board = root.querySelector<HTMLElement>('.map-canvas');
    if (board && this.renderedKey) this.positions.set(this.renderedKey, board.scrollLeft);
    const focused = root.ownerDocument.activeElement;
    if (!(focused instanceof Element) || !root.contains(focused)) return null;
    const section = focused.closest('section');
    const heading = section?.querySelector('h2');
    return {
      id: focused.id,
      destination: focused.getAttribute('data-destination'),
      list: !!focused.closest('.destination-list'),
      form: focused.closest('form')?.id,
      name: focused.getAttribute('name'),
      heading: heading?.textContent,
      region: focused.closest('[data-focus-region]')?.getAttribute('data-focus-region'),
      key: this.renderedKey,
    };
  }

  restore(root: HTMLElement, campaignId: string, mapId: string, focus: ReturnType<MapViewState['capture']>) {
    const key = JSON.stringify([campaignId, mapId]);
    const board = root.querySelector<HTMLElement>('.map-canvas');
    if (board) board.scrollLeft = this.positions.get(key) ?? 0;
    if (focus) {
      let target: Element | undefined | null;
      if (focus.key === key) {
        if (focus.id) target = Array.from(root.querySelectorAll('[id]')).find(el => el.id === focus.id);
        else if (focus.destination) target = Array.from(root.querySelectorAll('[data-destination]')).find(el =>
          el.getAttribute('data-destination') === focus.destination && !!el.closest('.destination-list') === focus.list);
        else if (focus.form) {
          const form = Array.from(root.querySelectorAll('form')).find(el => el.id === focus.form);
          target = focus.name ? Array.from(form?.elements ?? []).find(el => el.getAttribute('name') === focus.name) : form?.querySelector('button');
        }
        if (!target || target.matches(':disabled')) {
          target = Array.from(root.querySelectorAll('h2')).find(el => el.textContent === focus.heading);
          target ??= Array.from(root.querySelectorAll('[data-focus-region]')).find(el => el.getAttribute('data-focus-region') === focus.region)?.querySelector('h2');
        }
      }
      target ??= root.querySelector('#map-title');
      if (target && 'focus' in target) {
        if (/^H[12]$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
        (target as HTMLElement).focus({ preventScroll: true });
      }
    }
    this.renderedKey = key;
  }
}
