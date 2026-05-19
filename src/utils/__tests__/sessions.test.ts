import { applyRsvp, applyCancel } from '../sessions';
import { PeladaSession } from '../../types';

function makeSession(overrides: Partial<PeladaSession> = {}): PeladaSession {
  return {
    id: 's1',
    date: '2026-06-01',
    maxPlayers: 3,
    rsvps: [],
    waitlist: [],
    status: 'scheduled',
    ...overrides,
  };
}

describe('applyRsvp', () => {
  test('confirms when there is room', () => {
    const s = makeSession();
    const r = applyRsvp(s, 'p1');
    expect(r.outcome).toBe('confirmed');
    expect(r.session.rsvps).toEqual(['p1']);
    expect(r.session.waitlist).toEqual([]);
  });

  test('confirms multiple distinct players in order', () => {
    let r = applyRsvp(makeSession(), 'a');
    r = applyRsvp(r.session, 'b');
    r = applyRsvp(r.session, 'c');
    expect(r.session.rsvps).toEqual(['a', 'b', 'c']);
    expect(r.outcome).toBe('confirmed');
  });

  test('waitlists when capacity is full', () => {
    const s = makeSession({ rsvps: ['a', 'b', 'c'], maxPlayers: 3 });
    const r = applyRsvp(s, 'd');
    expect(r.outcome).toBe('waitlisted');
    expect(r.session.rsvps).toEqual(['a', 'b', 'c']);
    expect(r.session.waitlist).toEqual(['d']);
  });

  test('returns already_confirmed without duplicating', () => {
    const s = makeSession({ rsvps: ['a'] });
    const r = applyRsvp(s, 'a');
    expect(r.outcome).toBe('already_confirmed');
    expect(r.session.rsvps).toEqual(['a']); // no duplicate
  });

  test('returns already_waitlisted without duplicating', () => {
    const s = makeSession({ rsvps: ['a', 'b', 'c'], waitlist: ['d'] });
    const r = applyRsvp(s, 'd');
    expect(r.outcome).toBe('already_waitlisted');
    expect(r.session.waitlist).toEqual(['d']); // no duplicate
  });

  test('does not mutate the input session', () => {
    const s = makeSession();
    applyRsvp(s, 'a');
    expect(s.rsvps).toEqual([]);
  });
});

describe('applyCancel', () => {
  test('removes from rsvps when no waitlist', () => {
    const s = makeSession({ rsvps: ['a', 'b'] });
    const next = applyCancel(s, 'a');
    expect(next.rsvps).toEqual(['b']);
    expect(next.waitlist).toEqual([]);
  });

  test('promotes first waitlist player when rsvp slot opens', () => {
    const s = makeSession({
      rsvps: ['a', 'b', 'c'],
      waitlist: ['d', 'e'],
    });
    const next = applyCancel(s, 'a');
    expect(next.rsvps).toEqual(['b', 'c', 'd']);
    expect(next.waitlist).toEqual(['e']);
  });

  test('removes from waitlist (no promotion needed)', () => {
    const s = makeSession({
      rsvps: ['a', 'b', 'c'],
      waitlist: ['d', 'e'],
    });
    const next = applyCancel(s, 'e');
    expect(next.rsvps).toEqual(['a', 'b', 'c']);
    expect(next.waitlist).toEqual(['d']);
  });

  test('no-op when player is in neither list', () => {
    const s = makeSession({ rsvps: ['a'], waitlist: ['b'] });
    const next = applyCancel(s, 'z');
    expect(next).toBe(s); // exact reference — no copy on no-op
  });

  test('does not mutate the input session', () => {
    const s = makeSession({ rsvps: ['a', 'b'], waitlist: ['c'] });
    applyCancel(s, 'a');
    expect(s.rsvps).toEqual(['a', 'b']);
    expect(s.waitlist).toEqual(['c']);
  });

  test('round-trip: rsvp full → waitlist → cancel head → first waitlist promotes', () => {
    let r = applyRsvp(makeSession({ maxPlayers: 2 }), 'a');
    r = applyRsvp(r.session, 'b');
    r = applyRsvp(r.session, 'c'); // c goes to waitlist
    expect(r.session.rsvps).toEqual(['a', 'b']);
    expect(r.session.waitlist).toEqual(['c']);

    const after = applyCancel(r.session, 'a');
    expect(after.rsvps).toEqual(['b', 'c']);
    expect(after.waitlist).toEqual([]);
  });
});
