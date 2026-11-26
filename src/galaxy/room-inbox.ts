import { roomRequest } from '../rooms/client';
import { decideRoomRoute, proposalEntries, type ReviewDecision, type SharedProposal } from '../rooms/map-view';
import type { HostedRoom, RoomList } from '../rooms/types';
import type { RoomCoursePreview } from './room-course';

type PreparePreview = (preview: RoomCoursePreview) => (() => void) | undefined;
const refreshInterval = 10_000;

export class RoomInbox {
  readonly element = document.createElement('section');
  private readonly heading = document.createElement('h2');
  private readonly refreshButton = document.createElement('button');
  private readonly feedback = document.createElement('p');
  private readonly groups = document.createElement('div');
  private rooms: HostedRoom[] = [];
  private canHost = false;
  private signature = '';
  private timer?: ReturnType<typeof setTimeout>;
  private requested = false;
  private refreshing = false;
  private deciding = false;
  private suspended = false;

  constructor(initial: RoomList | null, private readonly preparePreview: PreparePreview) {
    this.element.className = 'panel room-inbox';
    this.element.setAttribute('aria-labelledby', 'route-inbox-title');
    this.heading.id = 'route-inbox-title';
    this.heading.tabIndex = -1;
    this.heading.textContent = 'Route proposals';
    this.refreshButton.id = 'route-inbox-refresh';
    this.refreshButton.type = 'button';
    this.refreshButton.textContent = 'Refresh proposals';
    this.refreshButton.onclick = () => void this.refresh();
    this.feedback.className = 'route-inbox-feedback';
    this.feedback.setAttribute('role', 'status');
    this.element.append(this.heading, this.refreshButton, this.feedback, this.groups);

    if (initial) this.receive(initial);
    else this.paint();
    document.addEventListener('visibilitychange', () => {
      clearTimeout(this.timer);
      if (!document.hidden && this.canHost) void this.refresh();
    });
    window.addEventListener('pagehide', () => {
      this.suspended = true;
      clearTimeout(this.timer);
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      this.suspended = false;
      if (this.canHost) void this.refresh();
    });
    this.schedule();
  }

  private activeRooms() {
    return this.rooms.filter(room => room.planner && room.expiresAt > Date.now());
  }

  private schedule() {
    clearTimeout(this.timer);
    if (this.suspended || document.hidden || this.refreshing || this.deciding || !this.canHost) return;
    const rooms = this.activeRooms();
    if (!rooms.length) return;
    const untilExpiry = Math.min(...rooms.map(room => room.expiresAt)) - Date.now();
    this.timer = setTimeout(() => void this.refresh(), Math.min(refreshInterval, Math.max(0, untilExpiry)));
  }

  private receive(list: RoomList) {
    this.canHost = list.canHost;
    this.rooms = list.canHost ? list.hosted : [];
    this.paint();
  }

  async refresh() {
    if (this.suspended || document.hidden) return;
    if (this.refreshing || this.deciding) {
      this.requested = true;
      return;
    }

    clearTimeout(this.timer);
    this.refreshing = true;
    this.requested = false;
    this.paint();
    try {
      this.receive(await roomRequest<RoomList>());
      if (this.feedback.dataset.issue === 'refresh') this.showFeedback('');
    } catch (cause) {
      if (!this.feedback.textContent || this.feedback.dataset.issue === 'refresh') {
        this.showFeedback(cause instanceof Error ? cause.message : 'Could not refresh route proposals.', 'refresh');
      }
    } finally {
      this.refreshing = false;
      this.paint();
      if (this.requested) void this.refresh();
      else this.schedule();
    }
  }

  private showFeedback(text: string, issue = '') {
    this.feedback.textContent = text;
    this.feedback.dataset.issue = issue;
  }

  private paint() {
    this.element.hidden = !this.canHost;
    this.refreshButton.disabled = this.deciding;
    const rooms = this.activeRooms();
    const signature = JSON.stringify([this.deciding, rooms.map(room => [room.id, room.code, room.planner])]);
    if (signature === this.signature) return;
    this.signature = signature;
    const focused = this.groups.contains(document.activeElement) ? document.activeElement?.id : '';
    const sections = rooms.map(room => {
      const planner = room.planner!;
      const section = document.createElement('section');
      section.className = 'route-inbox-room';
      const heading = document.createElement('h3');
      heading.textContent = 'Room ' + room.code;
      section.append(heading, ...proposalEntries(room.id, planner, (proposal, decision) => {
        void this.review(room, proposal, decision);
      }, this.deciding));
      return section;
    });
    if (!sections.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Share a map with a room to receive route proposals.';
      sections.push(empty);
    }
    this.groups.replaceChildren(...sections);
    if (focused) {
      const control = document.getElementById(focused);
      (control && !control.matches(':disabled') ? control : this.deciding ? this.heading : this.refreshButton)
        .focus({ preventScroll: true });
    }
  }

  private async review(room: HostedRoom, proposal: SharedProposal, decision: ReviewDecision) {
    if (this.deciding) return;
    const planner = room.planner!;
    this.deciding = true;
    let recorded = false;
    this.showFeedback('');
    try {
      if (room.expiresAt <= Date.now()) throw Error('This room has expired.');
      const apply = decision === 'accepted' ? this.preparePreview({
        source: planner.source, map: planner.map, stops: proposal.stops,
      }) : undefined;
      if (decision === 'accepted' && !apply) return;
      this.paint();
      await decideRoomRoute(room.id, planner, proposal, decision);
      recorded = true;
      if (apply) apply();
      this.showFeedback(decision === 'accepted' ? 'Course accepted.' : 'Proposal declined.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not review this proposal.';
      this.showFeedback(recorded ? 'Course accepted. ' + message : message, 'decision');
    } finally {
      this.deciding = false;
      this.paint();
      await this.refresh();
    }
  }
}
