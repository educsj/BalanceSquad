import { computeSessionTrigger, titleKeyForLead, formatDateBR } from '../notificationsCore';

describe('computeSessionTrigger', () => {
  test('returns null when session has no time', () => {
    expect(
      computeSessionTrigger('2026-06-15', undefined, 2)
    ).toBeNull();
  });

  test('subtracts leadHours from the session datetime', () => {
    // Session: June 15 2026 at 19:00. Lead: 2h → trigger at 17:00.
    const now = new Date(2026, 5, 1, 12, 0, 0); // June 1
    const trigger = computeSessionTrigger('2026-06-15', '19:00', 2, now);
    expect(trigger).not.toBeNull();
    expect(trigger!.getHours()).toBe(17);
    expect(trigger!.getMinutes()).toBe(0);
    expect(trigger!.getDate()).toBe(15);
    expect(trigger!.getMonth()).toBe(5); // June
  });

  test('day-before lead crosses midnight', () => {
    // Session: June 15 at 09:00. Lead: 24h → trigger June 14 at 09:00.
    const now = new Date(2026, 5, 1, 12, 0, 0);
    const trigger = computeSessionTrigger('2026-06-15', '09:00', 24, now);
    expect(trigger!.getDate()).toBe(14);
    expect(trigger!.getHours()).toBe(9);
  });

  test('returns null when the trigger would be in the past', () => {
    const now = new Date(2026, 5, 15, 18, 0, 0); // Session day at 18h
    // Session at 19:00 with 2h lead → trigger at 17:00, but it's already 18h.
    const trigger = computeSessionTrigger('2026-06-15', '19:00', 2, now);
    expect(trigger).toBeNull();
  });

  test('returns null on malformed input', () => {
    expect(computeSessionTrigger('not-a-date', '19:00', 2)).toBeNull();
    expect(computeSessionTrigger('2026-06-15', 'xx:yy', 2)).toBeNull();
  });

  test('default `now` is the current time (sanity check)', () => {
    // Future date, real-time call — should not be null
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const iso = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    const trigger = computeSessionTrigger(iso, '20:00', 1);
    expect(trigger).not.toBeNull();
  });
});

describe('titleKeyForLead', () => {
  test.each([
    [1, 'soon'],
    [2, 'soon'],
    [3, 'soon'],
    [4, 'today'],
    [12, 'today'],
    [23, 'today'],
    [24, 'tomorrow'],
    [48, 'tomorrow'],
  ])('lead=%i → %s', (lead, expected) => {
    expect(titleKeyForLead(lead)).toBe(expected);
  });
});

describe('formatDateBR', () => {
  test('YYYY-MM-DD → DD/MM/YYYY', () => {
    expect(formatDateBR('2026-05-19')).toBe('19/05/2026');
  });
});
