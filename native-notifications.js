// ─── Native Notifications Bridge ───
// Uses Android's native AlarmManager when running inside the native app.
// Falls back to web push for browser users.

(function () {
  'use strict';

  // Detect if running inside the native Android app
  const isNative = typeof AndroidNotifications !== 'undefined' && AndroidNotifications.isNative();

  if (!isNative) {
    console.log('[NativeNotif] Not running in native app, using web push.');
    window._nativeNotifications = { isNative: false };
    return;
  }

  console.log('[NativeNotif] Running inside native Android app! Using native notifications.');

  // Schedule a local notification for a habit reminder
  function scheduleReminder(habitId, habitName, reminderTime) {
    try {
      const [hours, minutes] = reminderTime.split(':').map(Number);
      AndroidNotifications.scheduleNotification(habitId, habitName, hours, minutes);
      console.log(`[NativeNotif] Scheduled "${habitName}" at ${reminderTime}`);
      return true;
    } catch (e) {
      console.error('[NativeNotif] Schedule error:', e);
      return false;
    }
  }

  // Cancel a scheduled notification for a habit
  function cancelReminder(habitId) {
    try {
      AndroidNotifications.cancelNotification(habitId);
      console.log(`[NativeNotif] Cancelled notification for ${habitId}`);
    } catch (e) {
      // Ignore
    }
  }

  // Schedule all timed habits
  function scheduleAllReminders(habits, completedIds) {
    const timedHabits = habits.filter(h => h.timed && h.reminderTime);
    for (const habit of timedHabits) {
      const isCompleted = completedIds && completedIds.includes(habit.id);
      if (!isCompleted) {
        scheduleReminder(habit.id, habit.name, habit.reminderTime);
      } else {
        cancelReminder(habit.id);
      }
    }
    console.log(`[NativeNotif] Processed ${timedHabits.length} reminders`);
  }

  // Expose the API globally
  window._nativeNotifications = {
    isNative: true,
    scheduleReminder,
    cancelReminder,
    scheduleAllReminders,
  };

  console.log('[NativeNotif] Native notification bridge ready');
})();
