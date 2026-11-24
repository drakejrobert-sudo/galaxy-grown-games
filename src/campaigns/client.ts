import { exportCampaign, validateArchive } from '../galaxy/storage';
import type { Archive, Campaign } from '../galaxy/model';
import type { CloudList, CloudSave } from './types';
import { CLOUD_MAX_BYTES } from './types';

export class CloudError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export async function cloudRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/campaigns' + path, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(60_000),
    });
  } catch { throw Error('Cloud save could not be reached. Retry the same upload or export a local backup.'); }
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw Error('Cloud saves are unavailable. Local saves and exports still work.');
  const data = await response.json();
  if (!response.ok) throw new CloudError(response.status, data.error ?? 'Cloud operation failed.');
  return data;
}

type Pending = { campaignId: string; account: string; path: string; method: string; body: { account: string; id: string; operationId: string; revision: number; archive: Archive } };
export class CampaignCloud {
  account = '';
  saves: CloudSave[] = [];
  selected = '';
  busy = false;
  loaded = false;
  signedOut = false;
  status = '';
  pending: Pending | null = null;
  conflict = false;
  onChange = () => {};
  constructor(private request = cloudRequest) {}

  async refresh() {
    const list = await this.request<CloudList>();
    if (this.account !== list.account) { this.selected = ''; this.pending = null; }
    this.account = list.account; this.saves = list.saves;
    if (!this.saves.some(s => s.id === this.selected)) this.selected = '';
    this.loaded = true; this.signedOut = false;
  }
  async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.status = ''; this.conflict = false; this.onChange();
    try { await action(); }
    catch (e) {
      if (e instanceof CloudError && e.status === 401) {
        this.account = ''; this.saves = []; this.selected = ''; this.pending = null; this.signedOut = true;
      }
      if (e instanceof CloudError && [404, 409].includes(e.status)) {
        try { await this.refresh(); } catch { /* Preserve the original operation error. */ }
      }
      if (e instanceof CloudError && e.status === 409) { this.conflict = true; this.pending = null; }
      if (e instanceof CloudError && [400, 403, 404, 410, 429].includes(e.status)) this.pending = null;
      this.status = e instanceof Error ? e.message : 'Cloud operation failed. Local campaigns are unchanged.';
    } finally { this.busy = false; this.onChange(); }
  }
  async save(campaign: Campaign, update: boolean) {
    const selected = this.saves.find(s => s.id === this.selected);
    if (update && !selected) throw Error('Select a cloud save to update.');
    if (!this.account) throw Error('Refresh and sign in before saving.');
    const archive = validateArchive(JSON.parse(exportCampaign(campaign)));
    if (new TextEncoder().encode(JSON.stringify(archive)).length > CLOUD_MAX_BYTES) throw Error('Cloud save exceeds 10 MB. Export a local backup instead.');
    this.pending = { campaignId: campaign.id, account: this.account, path: update ? '/' + selected!.id : '', method: update ? 'PUT' : 'POST',
      body: { account: this.account, id: update ? selected!.id : crypto.randomUUID(), operationId: crypto.randomUUID(), revision: update ? selected!.revision : 0, archive } };
    await this.retry(campaign.id);
  }
  async retry(campaignId: string) {
    const pending = this.pending;
    if (!pending || pending.campaignId !== campaignId) throw Error('Select the original local campaign to retry its upload, or start a new save.');
    const result = await this.request<{save: CloudSave}>(pending.path, pending.method, pending.body);
    // Confirm the current browser identity before retaining any private cloud selection.
    await this.refresh();
    if (this.account !== pending.account) throw Error('Account changed. Refresh cloud saves before continuing.');
    this.selected = result.save.id; this.pending = null;
    this.status = `Saved “${result.save.name}” to cloud. Later local edits need another explicit save.`;
  }
  async read(id: string): Promise<Archive> {
    const account = this.account;
    const result = await this.request<{archive: Archive}>('/' + id);
    await this.refresh();
    if (!account || this.account !== account) throw Error('Account changed. No local campaign was restored.');
    return validateArchive(result.archive);
  }
  async remove(save: CloudSave) {
    await this.request('/' + save.id, 'DELETE', { revision: save.revision, account: this.account });
    await this.refresh(); this.status = 'Cloud save deleted. Local copies are unchanged.';
  }
}
