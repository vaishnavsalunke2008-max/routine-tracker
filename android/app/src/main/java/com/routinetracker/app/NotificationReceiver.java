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
    }
}
