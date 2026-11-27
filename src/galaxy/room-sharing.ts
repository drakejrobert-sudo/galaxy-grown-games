import { roomRequest } from '../rooms/client';
import { connected, readSharedMap, roomArtworkRevision, type SharedMap } from '../rooms/map-types';
import type { RoomList } from '../rooms/types';
import { activeMap, type Campaign, type SectorMap } from './model';

export function shareSchematic(sector: SectorMap, start: string, stops: Iterable<string>, routes: Iterable<string>): SharedMap {
  if (sector.journey && !sector.journey.arrived) throw Error('End this map’s journey before sharing a new course.');
  if (sector.location && start !== sector.location) throw Error('Start at your current destination.');
  const stopIds = new Set(stops);
  const routeIds = new Set(routes);
  const schematic = readSharedMap({
    start,
    stops: sector.destinations.filter(stop => stopIds.has(stop.id) && stop.navigable !== false)
      .map(({ id, name, x, y, type }) => ({ id, name, x, y, type })),
    links: sector.routes.filter(route => routeIds.has(route.id) && stopIds.has(route.from) && stopIds.has(route.to))
      .map(({ from, to }) => [from, to]),
  });
  if (!schematic) throw Error('Select the starting stop, at least one connected stop, and their connection.');
  return schematic;
}

function label(text: string, input: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  if (input instanceof HTMLInputElement && input.type === 'checkbox') label.append(input, text);
  else label.append(text, input);
  return label;
}

export function shareMapPanel(panel: HTMLElement, campaign: Campaign, save: () => void, onShared: () => void) {
  const map = activeMap(campaign);
  const load = panel.querySelector<HTMLButtonElement>('button')!;
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  panel.append(feedback);
  load.onclick = async () => {
    load.disabled = true;
    feedback.textContent = 'Loading rooms…';
    try {
      if (map.journey && !map.journey.arrived) throw Error('End this map’s journey before sharing a new course.');
      const { hosted, canHost } = await roomRequest<RoomList>();
      if (!canHost || !hosted.length) throw Error('Sign in as DM and create a room from Rooms first.');
      const illustration = map.backgroundImage;
      const artworkRevision = illustration ? await roomArtworkRevision(illustration) : undefined;
      if (!panel.isConnected) return;
      const published = new Map<string, SharedMap & { artworkRevision?: string }>(hosted.flatMap(item => {
        const planner = item.planner;
        return planner?.source.campaignId === campaign.id && planner.source.mapId === map.id
          ? [[item.id, planner.map] as const] : [];
      }));

      const form = document.createElement('form');
      form.className = 'map-form room-map-share';
      const room = document.createElement('select');
      room.add(new Option('Choose a room', ''));
      room.required = true;
      for (const item of hosted) room.add(new Option('Room code ' + item.code, item.id));

      const start = document.createElement('select');
      start.required = true;
      start.add(new Option('Choose a starting stop', ''));
      const destinations = new Map(map.destinations.filter(stop => stop.navigable !== false).map(stop => [stop.id, stop.name]));
      for (const [id, name] of destinations) start.add(new Option(name, id));
      if (map.location) {
        start.value = map.location;
        start.disabled = true;
      }

      const stops = document.createElement('fieldset');
      const stopsTitle = document.createElement('legend');
      stopsTitle.textContent = 'Stops to reveal';
      stops.append(stopsTitle);
      const stopInputs = new Map<string, HTMLInputElement>();
      for (const [id, name] of destinations) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        stops.append(label(name, checkbox));
        stopInputs.set(id, checkbox);
      }

      const routes = document.createElement('fieldset');
      const routesTitle = document.createElement('legend');
      routesTitle.textContent = 'Connections to reveal';
      routes.append(routesTitle);
      const routeInputs = new Map<string, { input: HTMLInputElement; ends: string[] }>();
      for (const { id, from, to } of map.routes) {
        if (!destinations.has(from) || !destinations.has(to)) continue;
        const input = document.createElement('input');
        input.type = 'checkbox';
        const row = label(destinations.get(from) + ' ↔ ' + destinations.get(to), input);
        routes.append(row);
        routeInputs.set(id, { input, ends: [from, to] });
      }
      function updateChoices() {
        for (const [id, input] of stopInputs) {
          input.disabled = id === start.value;
          if (input.disabled) input.checked = true;
        }
        for (const { input, ends } of routeInputs.values()) {
          input.disabled = !ends.every(id => stopInputs.get(id)?.checked);
          input.parentElement!.hidden = input.disabled;
          if (input.disabled) input.checked = false;
        }
      }
      const shareArt = document.createElement('input');
      shareArt.type = 'checkbox';
      const artwork = document.createElement('div');
      if (illustration) {
        const preview = document.createElement('img');
        preview.src = illustration;
        preview.alt = 'Background preview';
        preview.className = 'room-share-preview';
        const warning = document.createElement('p');
        warning.className = 'help';
        warning.textContent = 'Check the entire image for unrevealed details before sharing it.';
        artwork.append(preview, label('Share background artwork', shareArt), warning);
      }

      function restoreChoices() {
        const shared = published.get(room.value);
        start.value = map.location ?? shared?.start ?? '';
        for (const [id, input] of stopInputs) input.checked = shared?.stops.some(stop => stop.id === id) ?? false;
        for (const { input, ends } of routeInputs.values()) {
          input.checked = !!shared && connected(shared.links, ends[0], ends[1]);
        }
        shareArt.checked = !!artworkRevision && shared?.artworkRevision === artworkRevision;
        updateChoices();
      }
      room.onchange = restoreChoices;
      start.onchange = updateChoices;
      stops.onchange = updateChoices;
      updateChoices();

      const publish = document.createElement('button');
      publish.className = 'primary';
      publish.textContent = 'Share selected map';
      form.append(label('Room', room), label('Starting stop', start), stops, routes, artwork, publish);
      form.onsubmit = async event => {
        event.preventDefault();
        publish.disabled = true;
        try {
          const schematic = shareSchematic(map, start.value,
            [...stopInputs].filter(([, input]) => input.checked).map(([id]) => id),
            [...routeInputs].filter(([, { input }]) => input.checked && !input.disabled).map(([id]) => id));
          save();
          const roomId = room.value;
          const includeArtwork = shareArt.checked;
          await roomRequest('/' + roomId + '/map', 'PUT', {
            campaignId: campaign.id, mapId: map.id, map: schematic, artwork: includeArtwork ? illustration : null,
          });
          published.set(roomId, { ...schematic, artworkRevision: includeArtwork ? artworkRevision : undefined });
          feedback.textContent = 'Map shared. Review proposals beside your map.';
          onShared();
        } catch (cause) {
          feedback.textContent = cause instanceof Error ? cause.message : 'Could not share this map.';
        } finally {
          publish.disabled = false;
        }
      };
      feedback.textContent = 'Changing stops, connections, or the starting point starts a new proposal round.';
      load.replaceWith(form);
    } catch (cause) {
      feedback.textContent = cause instanceof Error ? cause.message : 'Could not load DM rooms.';
      load.disabled = false;
    }
  };
}
