const key = 'galaxy-grown-prep-sections';

export class PrepDisclosure {
  private open = new Set<string>(['room-sharing']);

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
      if (Array.isArray(saved)) this.open = new Set(saved.filter(item => typeof item === 'string'));
    } catch { /* Presentation preferences are optional. */ }
  }

  section(name: string, title: string, content: string): string {
    return `<details class="panel prep-section" data-prep="${name}"${this.open.has(name) ? ' open' : ''}><summary><h2>${title}</h2></summary><div class="prep-section-content">${content}</div></details>`;
  }

  capture(root: ParentNode) {
    let changed = false;
    root.querySelectorAll<HTMLDetailsElement>('details[data-prep]').forEach(section => {
      const key = section.dataset.prep!;
      if (section.open === this.open.has(key)) return;
      changed = true;
      if (section.open) this.open.add(key);
      else this.open.delete(key);
    });
    if (changed) {
      try { localStorage.setItem(key, JSON.stringify([...this.open])); }
      catch { /* Retain the current layout in memory. */ }
    }
  }
}
