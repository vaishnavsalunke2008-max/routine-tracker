package com.routinetracker.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import androidx.core.app.NotificationCompat;

public class NotificationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String habitName = intent.getStringExtra("habitName");
        String habitId = intent.getStringExtra("habitId");

        if (habitName == null) habitName = "Your habit";

        // Open app when notification is tapped
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "habit-reminders")
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(habitName)
            .setContentText("\u23f0 It's time for: " + habitName)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setVibrate(new long[]{200, 100, 200})
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_SOUND);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            int notifId = habitId != null ? (habitId.hashCode() & 0x7fffffff) : 1;
            manager.notify(notifId, builder.build());
        }

        // Reschedule for the next occurrence
        int hour = intent.getIntExtra("hour", -1);
        int minute = intent.getIntExtra("minute", -1);
        if (hour != -1 && minute != -1 && habitId != null) {
            try {
                android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    Intent nextIntent = new Intent(context, NotificationReceiver.class);
                    nextIntent.putExtra("habitId", habitId);
                    nextIntent.putExtra("habitName", habitName);
                    nextIntent.putExtra("hour", hour);
                    nextIntent.putExtra("minute", minute);
                    
                    int requestCode = Math.abs(habitId.hashCode());
                    PendingIntent nextPendingIntent = PendingIntent.getBroadcast(
                        context, requestCode, nextIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );
                    
                    java.util.Calendar calendar = java.util.Calendar.getInstance();
                    calendar.set(java.util.Calendar.HOUR_OF_DAY, hour);
                    calendar.set(java.util.Calendar.MINUTE, minute);
                    calendar.set(java.util.Calendar.SECOND, 0);
                    calendar.set(java.util.Calendar.MILLISECOND, 0);
                    calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);
                    
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), nextPendingIntent);
                    } else {
                        alarmManager.setExact(android.app.AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), nextPendingIntent);
                    }
                }
            } catch (Exception e) {
                // ignore
            }
        }
    }
}
