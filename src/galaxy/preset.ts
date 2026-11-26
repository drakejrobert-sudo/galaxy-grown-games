import { uid, type Campaign } from './model';
import { parseArchive, type StorageLike } from './storage';

const key = 'galaxy-grown-private-preset';

export function loadPreset(storage: StorageLike): Campaign | undefined {
  const raw = storage.getItem(key);
  return raw === null ? undefined : presetCampaign(raw);
}

function presetCampaign(raw: string): Campaign {
  const archive = parseArchive(raw);
  return archive.campaigns.find(campaign => campaign.id === archive.selected)!;
}

export function installPreset(storage: StorageLike, raw: string): Campaign {
  const campaign = presetCampaign(raw);
  storage.setItem(key, JSON.stringify({ version: 2, selected: campaign.id, campaigns: [campaign] }));
  return campaign;
}

export function copyPreset(preset: Campaign, name: string): Campaign {
  const copy = structuredClone(preset);
  copy.id = uid();
  copy.name = name;
  for (const map of copy.maps) {
    map.journey = null;
    map.location = null;
    map.schedules = [];
    map.log = [];
  }
  return copy;
}
