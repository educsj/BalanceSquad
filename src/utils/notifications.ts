import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Pelada, PeladaSession } from '../types';
import { computeSessionTrigger, titleKeyForLead, formatDateBR } from './notificationsCore';

export { computeSessionTrigger };

// Wrapper around expo-notifications so the SDK calls stay in one place and
// the rest of the app deals in pure domain types. Local notifications only
// (no push server) — works inside Expo Go.

// Foreground behavior: show banner + play sound when a notification fires
// while the app is open. Called once on app boot.
export function configureNotificationBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Asks for notification permission if not yet granted. Returns true if the
// user said yes (or already had). Safe to call on every toggle activation —
// expo-notifications dedupes the OS prompt.
export async function ensureNotifPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  // Android needs an Android-specific channel for high-priority notifications
  // to actually surface as heads-up. Best-effort; ignore on iOS.
  if (Platform.OS === 'android' && status === 'granted') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#1E3A5F',
    });
  }
  return status === 'granted';
}

// Schedules a one-shot reminder for a single session. Returns the notif id
// (storable in `session.notificationId`) or null when the session can't be
// scheduled (no time, in the past, permission denied).
export async function scheduleSessionReminder(
  pelada: Pelada,
  session: PeladaSession,
  leadHours: number,
): Promise<string | null> {
  const trigger = computeSessionTrigger(session.date, session.time, leadHours);
  if (!trigger) return null;
  const granted = await ensureNotifPermission();
  if (!granted) return null;

  const confirmedCount = session.rsvps.length;
  const cap = session.maxPlayers;
  // OS-level notifications can't read i18next, so the strings are hardcoded
  // to PT here. Could be parameterized later if multi-locale matters at the
  // notification text level (current users are all PT-speaking organizers).
  const title = titleByLead(titleKeyForLead(leadHours), leadHours);
  const body = `${pelada.name} — ${formatDateBR(session.date)}${session.time ? ` ${session.time}` : ''}. ${confirmedCount}/${cap} confirmados.`;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: 'session', peladaId: pelada.id, sessionId: session.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });
  return id;
}

function titleByLead(key: 'tomorrow' | 'today' | 'soon', leadHours: number): string {
  if (key === 'tomorrow') return 'Pelada amanhã ⚽';
  if (key === 'today')    return 'Pelada hoje ⚽';
  return `Pelada em ${leadHours}h ⚽`;
}

export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // SDK throws if the id no longer exists (already fired / OS cleared).
    // We treat cancel as best-effort — no need to surface to the user.
  }
}

// Schedules (or replaces) a weekly recurring reminder for the organizer.
// Returns the notif id so the caller can cancel/replace it later.
export async function scheduleWeeklyAdminReminder(
  dayOfWeek: number,   // 0..6 (0=Sun..6=Sat), aligned with JS Date.getDay()
  time: string,        // HH:mm
): Promise<string | null> {
  const granted = await ensureNotifPermission();
  if (!granted) return null;
  const [hh, mm] = time.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  // expo-notifications WEEKLY uses 1=Sunday..7=Saturday (not 0-indexed).
  const weekday = dayOfWeek + 1;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hora da lista semanal 📋',
      body: 'Toque pra abrir a próxima pelada e mandar a lista no grupo.',
      data: { type: 'admin_weekly' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour: hh,
      minute: mm,
    },
  });
  return id;
}
