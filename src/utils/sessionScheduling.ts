// Orchestration layer between storage (persistence) and notifications (OS SDK).
// Lives in its own file so neither side depends on the other directly, and
// the UI gets a high-level API.
//
// Usage:
//   - After createSession → scheduleSessionReminderIfEnabled
//   - After cancel/delete session → cancelSessionReminderIfScheduled
//   - When lead time changes or session toggle flips → rescheduleAllSessions

import {
  getNotifSessionEnabled,
  getNotifLeadHours,
  getPeladaById,
  loadPeladas,
  setSessionNotificationId,
} from '../storage';
import { scheduleSessionReminder, cancelNotification } from './notifications';

// Cancels the existing notification (if any) and schedules a fresh one for
// the session — provided the user has session reminders enabled and the
// session has a future date+time. No-op otherwise.
export async function scheduleSessionReminderIfEnabled(
  peladaId: string,
  sessionId: string,
): Promise<void> {
  const enabled = await getNotifSessionEnabled();
  if (!enabled) return;

  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const session = pelada.sessions?.find(s => s.id === sessionId);
  if (!session || session.status !== 'scheduled') return;

  // Cancel any previously scheduled notification so we don't leak doubles
  // when the session date/time gets edited.
  if (session.notificationId) {
    await cancelNotification(session.notificationId);
    await setSessionNotificationId(peladaId, sessionId, null);
  }

  const leadHours = await getNotifLeadHours();
  const notifId = await scheduleSessionReminder(pelada, session, leadHours);
  if (notifId) {
    await setSessionNotificationId(peladaId, sessionId, notifId);
  }
}

// Cancels the scheduled notification for a session (best-effort).
export async function cancelSessionReminderIfScheduled(
  peladaId: string,
  sessionId: string,
): Promise<void> {
  const pelada = await getPeladaById(peladaId);
  if (!pelada) return;
  const session = pelada.sessions?.find(s => s.id === sessionId);
  if (!session?.notificationId) return;
  await cancelNotification(session.notificationId);
  await setSessionNotificationId(peladaId, sessionId, null);
}

// Re-schedules notifications for every upcoming session across every pelada.
// Called when:
//   - User toggles session reminders ON (need to schedule everything)
//   - User changes lead time (need to recalculate trigger times)
// When toggling OFF the caller should call `cancelAllSessionReminders` instead.
export async function rescheduleAllSessions(): Promise<void> {
  const peladas = await loadPeladas();
  for (const pelada of peladas) {
    for (const session of pelada.sessions ?? []) {
      if (session.status !== 'scheduled') continue;
      await scheduleSessionReminderIfEnabled(pelada.id, session.id);
    }
  }
}

// Cancels every scheduled session notification across all peladas — used when
// the user toggles session reminders OFF.
export async function cancelAllSessionReminders(): Promise<void> {
  const peladas = await loadPeladas();
  for (const pelada of peladas) {
    for (const session of pelada.sessions ?? []) {
      if (session.notificationId) {
        await cancelNotification(session.notificationId);
        await setSessionNotificationId(pelada.id, session.id, null);
      }
    }
  }
}
