import { roomRequest } from '../rooms/client';
import example from '../../docs/examples/shopfront.json';
import { maxShopBytes, readInventory, themes, type Inventory, type SavedShop, type ShopSummary, type StockItem } from './inventory';
import './shops.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, action: () => void) {
  const control = el('button', label);
  control.type = 'button';
  control.onclick = action;
  return control;
}

function labeled(label: string, input: HTMLElement) {
  const field = el('label', label);
  field.append(input);
  return field;
}

export function storefront(shop: Inventory) {
  const section = el('section');
  section.className = 'shopfront theme-' + shop.theme;
  section.setAttribute('aria-label', shop.name);
  const hero = el('div');
  hero.className = 'shop-banner';
  const image = el('img');
  image.src = import.meta.env.BASE_URL + 'shopfront/' + shop.theme + '.webp';
  image.alt = '';
  hero.append(image, el('span', themes[shop.theme]), el('h3', shop.name));
  const stock = el('ul');
  for (const item of shop.items) {
    const row = el('li');
    const details = el('div');
    details.append(el('strong', item.name));
    if (item.description) details.append(el('p', item.description));
    const numbers = el('div');
    numbers.className = 'shop-price';
    numbers.append(el('strong', item.price + ' ' + item.currency),
      el('small', item.quantity ? item.quantity + ' in stock' : 'Sold out'));
    row.append(details, numbers);
    stock.append(row);
  }
  section.append(hero, shop.items.length ? stock : el('p', 'No items in stock.'));
  return section;
}

function download(inventory: Inventory) {
  const link = el('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(inventory, null, 2)], { type: 'application/json' }));
  link.href = url;
  link.download = (inventory.name.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80) || 'shop') + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function itemEditor(item: StockItem, onChange: () => void) {
  const row = el('fieldset');
  const legend = el('legend', item.name || 'New item');
  row.append(legend);
  for (const [key, label] of [['name','Item name'], ['description','Description'], ['price','Price'],
    ['currency','Currency'], ['quantity','Quantity']] as const) {
    const input = el('input');
    const numeric = key === 'price' || key === 'quantity';
    input.type = numeric ? 'number' : 'text';
    if (numeric) { input.min = '0'; input.step = key === 'quantity' ? '1' : 'any'; }
    input.value = String(item[key] ?? '');
    input.oninput = () => {
      if (key === 'price' || key === 'quantity') item[key] = input.valueAsNumber;
      else item[key] = input.value;
      if (key === 'name') legend.textContent = item.name || 'New item';
      onChange();
    };
    row.append(labeled(label, input));
  }
  return row;
}

export function shopLibrary(panel: HTMLElement, afterSave: () => Promise<void>) {
  const select = el('select');
  const dialog = el('dialog');
  dialog.className = 'shop-editor';
  dialog.setAttribute('aria-label', 'Edit shop');
  let dirty = false;
  let saving = false;
  const canClose = () => !saving && (!dirty || window.confirm('Discard unsaved shop changes?'));
  dialog.oncancel = event => { if (!canClose()) event.preventDefault(); };
  const error = el('p');
  error.setAttribute('role', 'alert');
  const edit = button('Edit shop', async () => {
    edit.disabled = true;
    error.textContent = '';
    try { open(await roomRequest<SavedShop>('/shops/' + select.value)); }
    catch (cause) { error.textContent = String(cause); }
    finally { edit.disabled = !select.value; }
  });
  select.onchange = () => { edit.disabled = !select.value; };
  const create = button('New shop', () => open({ id: crypto.randomUUID(), revision: 0,
    inventory: { version: 1, name: '', theme: 'armorer', items: [] } }));
  const demoStatus = el('p');
  demoStatus.setAttribute('role', 'status');
  const demos = button('Load demo shops', async () => {
    demos.disabled = true;
    error.textContent = '';
    try {
      const { added } = await roomRequest<{ added: number }>('/shops/demos', 'POST');
      await afterSave();
      demoStatus.textContent = added ? 'Demo shops added to your library.' : 'Demo shops are already in your library.';
    } catch (cause) { error.textContent = String(cause); }
    finally { demos.disabled = false; }
  });
  panel.append(el('summary', 'Shop library'), labeled('Saved shops', select), edit, create, demos, demoStatus, error, dialog);

  function open(saved: SavedShop) {
    let draft = structuredClone(saved.inventory);
    let id = saved.id;
    let revision = saved.revision;
    dirty = false;
    const heading = el('h2', revision ? 'Edit shop' : 'New shop');
    const close = button('Close editor', () => { if (canClose()) dialog.close(); });
    const notice = el('p');
    notice.setAttribute('role', 'status');
    const editor = el('div');
    const preview = el('div');
    const changed = () => { dirty = true; preview.replaceChildren(); notice.textContent = ''; };
    const report = (cause: unknown) => { notice.textContent = cause instanceof Error ? cause.message : String(cause); };
    const file = el('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.onchange = async () => {
      const source = file.files?.[0];
      if (!source) return;
      try {
        if (source.size > maxShopBytes) throw new Error('Choose a JSON file under 256 KB.');
        const imported = readInventory(JSON.parse(await source.text()));
        if (!dialog.open || !file.isConnected) return;
        draft = imported;
        changed();
        renderFields();
        preview.replaceChildren(storefront(draft));
        notice.textContent = 'Imported preview. Save shop to apply this inventory.';
      } catch (cause) { report(cause); }
      finally { file.value = ''; }
    };
    function renderFields() {
      const name = el('input');
      name.type = 'text';
      name.value = draft.name;
      name.oninput = () => { draft.name = name.value; changed(); };
      const theme = el('select');
      for (const [value, label] of Object.entries(themes)) theme.add(new Option(label, value));
      theme.value = draft.theme;
      theme.onchange = () => { draft.theme = theme.value as Inventory['theme']; changed(); };
      const rows = el('div');
      function append(item: StockItem) {
        const row = itemEditor(item, changed);
        row.append(button('Remove item', () => {
          draft.items.splice(draft.items.indexOf(item), 1);
          row.remove();
          changed();
        }));
        rows.append(row);
        return row;
      }
      draft.items.forEach(append);
      editor.replaceChildren(labeled('Shop name', name), labeled('Theme', theme), rows, button('Add item', () => {
        const item = { id: crypto.randomUUID(), name: '', price: 0, currency: draft.items.at(-1)?.currency ?? 'credits', quantity: 1 };
        draft.items.push(item);
        changed();
        append(item).querySelector('input')?.focus();
      }));
    }
    const save = button('Save shop', async () => {
      if (saving) return;
      try {
        const inventory = readInventory(draft);
        saving = true;
        dialog.inert = true;
        const result = await roomRequest<SavedShop>('/shops/' + id, 'PUT', { revision, inventory });
        revision = result.revision;
        dirty = false;
        await afterSave();
        select.value = id;
        edit.disabled = false;
        dialog.close();
      } catch (cause) { report(cause); }
      finally { saving = false; dialog.inert = false; }
    });
    const duplicate = button('Duplicate shop', () => {
      id = crypto.randomUUID();
      revision = 0;
      draft.name = draft.name.slice(0, 73) + ' (copy)';
      heading.textContent = 'New shop copy';
      duplicate.hidden = true;
      changed();
      renderFields();
      notice.textContent = 'Save this copy to keep its stock independent.';
    });
    duplicate.hidden = !revision;
    renderFields();
    const actions = el('div');
    actions.className = 'shop-actions';
    actions.append(button('Preview shop', () => {
      try { preview.replaceChildren(storefront(readInventory(draft))); notice.textContent = 'Private preview'; }
      catch (cause) { report(cause); }
    }), button('Export JSON', () => {
      try { download(readInventory(draft)); } catch (cause) { report(cause); }
    }), duplicate, save);
    dialog.replaceChildren(heading, close, labeled('Import inventory JSON', file),
      button('Download example', () => download(readInventory(example))), editor, actions, notice, preview);
    dialog.showModal();
  }
  return (shops: ShopSummary[]) => {
    const selected = select.value;
    select.replaceChildren(new Option('Choose a shop', ''), ...shops.map(shop => new Option(shop.name, shop.id)));
    select.value = selected;
    edit.disabled = !select.value;
  };
}
