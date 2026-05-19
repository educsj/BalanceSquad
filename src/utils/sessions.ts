import { PeladaSession } from '../types';

// Pure state transitions for a PeladaSession. No I/O — storage.ts wraps these
// in AsyncStorage calls. Keeping them here makes the lifecycle testable.

export type RsvpOutcome =
  | 'confirmed'
  | 'waitlisted'
  | 'already_confirmed'
  | 'already_waitlisted';

export interface RsvpResult {
  session: PeladaSession;
  outcome: RsvpOutcome;
}

// Adds `playerId` to rsvps if the session has room, else to the waitlist.
// Idempotent — calling twice with the same player returns 'already_*' without
// duplicating entries.
export function applyRsvp(session: PeladaSession, playerId: string): RsvpResult {
  if (session.rsvps.includes(playerId)) {
    return { session, outcome: 'already_confirmed' };
  }
  if (session.waitlist.includes(playerId)) {
    return { session, outcome: 'already_waitlisted' };
  }
  if (session.rsvps.length < session.maxPlayers) {
    return {
      session: { ...session, rsvps: [...session.rsvps, playerId] },
      outcome: 'confirmed',
    };
  }
  return {
    session: { ...session, waitlist: [...session.waitlist, playerId] },
    outcome: 'waitlisted',
  };
}

// Removes `playerId` from the session. If they were in rsvps and the waitlist
// has anyone, auto-promotes waitlist[0] to fill the slot. No-op if the player
// isn't in either list.
export function applyCancel(session: PeladaSession, playerId: string): PeladaSession {
  if (session.rsvps.includes(playerId)) {
    const nextRsvps = session.rsvps.filter(id => id !== playerId);
    if (session.waitlist.length > 0) {
      const [promoted, ...restWaitlist] = session.waitlist;
      return {
        ...session,
        rsvps: [...nextRsvps, promoted],
        waitlist: restWaitlist,
      };
    }
    return { ...session, rsvps: nextRsvps };
  }
  if (session.waitlist.includes(playerId)) {
    return { ...session, waitlist: session.waitlist.filter(id => id !== playerId) };
  }
  return session;
}
