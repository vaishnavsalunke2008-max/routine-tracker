// ─── Native Notifications Bridge ───
// Uses Capacitor Local Notifications when running as a native app.
// Falls back to web push for browser users.

(function () {
  'use strict';

  // Detect if running inside Capacitor native shell
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  if (!isNative) {
    console.log('[NativeNotif] Not running in Capacitor, skipping native notifications.');
    window._nativeNotifications = { isNative: false };
    return;
  }

  console.log('[NativeNotif] Running inside Capacitor! Setting up native local notifications.');

  const { LocalNotifications } = Capacitor.Plugins;

  // Request permission for local notifications
  async function requestPermission() {
    try {
      const result = await LocalNotifications.requestPermissions();
      console.log('[NativeNotif] Permission result:', result);
      return result.display === 'granted';
    } catch (e) {
      console.error('[NativeNotif] Permission error:', e);
      return false;
    }
  }

  // Schedule a local notification for a habit reminder
  // habitId: unique string id
  // habitName: display name
  // reminderTime: "HH:MM" string in local time
  async function scheduleReminder(habitId, habitName, reminderTime) {
    try {
      // Cancel any existing notification for this habit first
      await cancelReminder(habitId);

      const [hours, minutes] = reminderTime.split(':').map(Number);

      // Calculate the next occurrence of this time
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      // Generate a numeric ID from the habit string ID
      const numericId = hashStringToInt(habitId);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title: habitName,
            body: `⏰ It's time for: ${habitName}`,
            schedule: {
              at: target,
              repeats: true,
              every: 'day',
            },
            channelId: 'habit-reminders',
            smallIcon: 'ic_stat_icon',
            largeIcon: 'ic_launcher',
            sound: 'default',
            extra: {
              habitId: habitId,
              type: 'habit',
            },
          },
        ],
      });

      console.log(`[NativeNotif] Scheduled "${habitName}" at ${reminderTime} (id: ${numericId})`);
      return true;
    } catch (e) {
      console.error('[NativeNotif] Schedule error:', e);
      return false;
    }
  }

  // Cancel a scheduled notification for a habit
  async function cancelReminder(habitId) {
    try {
      const numericId = hashStringToInt(habitId);
      await LocalNotifications.cancel({
        notifications: [{ id: numericId }],
      });
      console.log(`[NativeNotif] Cancelled notification for habit ${habitId} (id: ${numericId})`);
    } catch (e) {
      // Ignore errors when cancelling non-existent notifications
    }
  }

  // Cancel all scheduled notifications
  async function cancelAll() {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
        console.log(`[NativeNotif] Cancelled ${pending.notifications.length} notifications`);
      }
    } catch (e) {
      console.error('[NativeNotif] Cancel all error:', e);
    }
  }

  // Schedule all timed habits from the data
  async function scheduleAllReminders(habits, completedIds) {
    const granted = await requestPermission();
    if (!granted) {
      console.warn('[NativeNotif] Notification permission not granted');
      return;
    }

    // Create notification channel (Android 8+)
    try {
      await LocalNotifications.createChannel({
        id: 'habit-reminders',
        name: 'Habit Reminders',
        description: 'Notifications for your scheduled habit reminders',
        importance: 5, // MAX importance
        visibility: 1, // PUBLIC
        vibration: true,
        sound: 'default',
      });
    } catch (e) {
      // Channel might already exist, that's fine
    }

    // Cancel all existing notifications first
    await cancelAll();

    // Schedule new ones for incomplete timed habits
    const timedHabits = habits.filter(h => h.timed && h.reminderTime);
    for (const habit of timedHabits) {
      const isCompleted = completedIds && completedIds.includes(habit.id);
      if (!isCompleted) {
        await scheduleReminder(habit.id, habit.name, habit.reminderTime);
      }
    }

    console.log(`[NativeNotif] Scheduled ${timedHabits.filter(h => !(completedIds || []).includes(h.id)).length} reminders`);
  }

  // Convert a string ID to a positive integer (for notification IDs)
  function hashStringToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0x7fffffff; // Keep positive 31-bit integer
    }
    return hash || 1; // Ensure non-zero
  }

  // Listen for notification actions
  LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
    console.log('[NativeNotif] Notification tapped:', notification);
    // Could navigate to specific habit here
  });

  // Expose the API globally
  window._nativeNotifications = {
    isNative: true,
    requestPermission,
    scheduleReminder,
    cancelReminder,
    cancelAll,
    scheduleAllReminders,
  };

  console.log('[NativeNotif] Native notification bridge ready');
})();
