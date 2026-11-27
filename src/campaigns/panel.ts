import { CampaignCloud } from './client';
import type { Archive, Campaign } from '../galaxy/model';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function cloudPanel(cloud: CampaignCloud, host: HTMLElement, current: () => Campaign,
  restore: (archive: Archive) => void, download: (text: string, name: string) => void) {
  function paint() {
    if (!host.isConnected) return;
    const focused = document.activeElement?.id;
    const selected = cloud.saves.find(s => s.id === cloud.selected);
    host.innerHTML = `<p>Save this campaign for another device. Restoring adds an independent local copy. Changes stay local until you save again.</p>
      <p class="help">Cloud saves are currently available only to the signed-in DM. Everyone can keep local saves and download backups. Up to 20 saves, 10 MB and 100 illustrated maps each, and 40 uploads per day.</p>
      <p role="status" aria-live="polite">${escape(cloud.status || (cloud.busy ? 'Working…' : cloud.loaded && !cloud.signedOut ? 'Cloud list is current as of your last refresh.' : 'Refresh cloud saves to check sign-in.'))}</p>
      ${cloud.signedOut || cloud.accessDenied ? '<a href="/signin-with-chatgpt?return_to=%2F%23%2Fmap" target="_top">Sign in for private saves</a>' : ''}
      <fieldset ${cloud.busy ? 'disabled' : ''}><button id="cloud-refresh">Refresh cloud saves</button>
      ${cloud.account ? `<label>Saved campaign<select id="cloud-select"><option value="">Choose a cloud save</option>${cloud.saves.map(s=>`<option value="${escape(s.id)}" ${s.id===cloud.selected?'selected':''}>${escape(s.name)}</option>`).join('')}</select></label>
      ${selected ? `<p>Last saved: ${escape(new Date(selected.updatedAt).toLocaleString())}</p>` : ''}
      <button id="cloud-new">Save local campaign as new cloud copy</button>
      <button id="cloud-update" ${!selected?'disabled':''}>Update selected cloud save</button>
      <button id="cloud-restore" ${!selected?'disabled':''}>Restore as independent local copy</button>
      <button id="cloud-export" ${!selected?'disabled':''}>Download complete cloud backup</button>
      <button id="cloud-delete" ${!selected?'disabled':''}>Delete selected cloud save</button>
      ${cloud.pending ? '<button id="cloud-retry">Retry same upload</button>' : ''}
      ${cloud.conflict ? '<p>The cloud copy changed. Restore it as a new local copy to review, save your local work as a new cloud copy, or use Export this campaign for a recovery backup.</p>' : ''}` : ''}</fieldset>`;
    const bind = (id: string, fn: () => Promise<void>) => host.querySelector('#' + id)?.addEventListener('click', () => {
      const work = cloud.run(fn); paint(); void work.then(paint);
    });
    bind('cloud-refresh', async () => { await cloud.refresh(); cloud.status = 'Cloud saves refreshed.'; });
    bind('cloud-new', async () => { await cloud.save(structuredClone(current()), false); });
    bind('cloud-update', async () => {
      const campaign = structuredClone(current()), save = cloud.saves.find(s => s.id === cloud.selected);
      if (save && confirm(`Replace cloud save “${save.name}” with local campaign “${campaign.name}”?`)) await cloud.save(campaign, true);
    });
    bind('cloud-retry', async () => { await cloud.retry(current().id); });
    bind('cloud-restore', async () => {
      const localId = current().id, id = cloud.selected;
      const incoming = await cloud.read(id);
      if (current().id !== localId || !host.isConnected) throw Error('Local campaign changed while loading. Select the intended campaign and restore again.');
      restore(incoming); cloud.status = 'Restored an independent local copy. Existing campaigns were preserved.';
    });
    bind('cloud-export', async () => { const incoming = await cloud.read(cloud.selected); download(JSON.stringify(incoming), 'galaxy-cloud-campaign.json'); cloud.status = 'Complete backup downloaded, including artwork.'; });
    bind('cloud-delete', async () => { const save = cloud.saves.find(s => s.id === cloud.selected); if (save && confirm(`Delete cloud save “${save.name}”? Local copies will remain.`)) await cloud.remove(save); });
    host.querySelector('#cloud-select')?.addEventListener('change', e => { cloud.selected = (e.target as HTMLSelectElement).value; cloud.conflict = false; paint(); });
    if (focused) (host.querySelector('#' + focused) as HTMLElement | null)?.focus({ preventScroll: true });
  }
  cloud.onChange = paint;
  paint();
}
