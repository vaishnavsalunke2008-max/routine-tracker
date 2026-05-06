package com.routinetracker.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.ConsoleMessage;
import android.net.Uri;
import android.view.View;
import android.view.Window;
import android.graphics.Color;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String TAG = "RoutineTracker";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#f5f5fa"));
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        createNotificationChannel();
        requestNotificationPermission();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Fix Google login — remove WebView identifier
        String ua = settings.getUserAgentString();
        ua = ua.replace("; wv)", ")");
        settings.setUserAgentString(ua + " RoutineTrackerApp");

        // Add native notification bridge
        webView.addJavascriptInterface(new NativeNotifBridge(this), "AndroidNotifications");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                
                // 1. If it's our Vercel app, load in WebView
                if (url.startsWith("https://routine-tracker-ebon.vercel.app") || url.equals("https://routine-tracker-ebon.vercel.app/")) {
                    return false;
                }
                
                // 2. If it's a Supabase OAuth authorize request, open in external Chrome
                if (url.contains("supabase.co") && url.contains("/auth/v1/authorize")) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                
                // 3. Other Supabase API requests load in WebView
                if (url.contains("supabase.co")) {
                    return false;
                }
                
                // 4. Everything else (including accounts.google.com) opens in external browser
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            }
        });

        // Log console messages for debugging
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, "JS: " + cm.message() + " (line " + cm.lineNumber() + ")");
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        Uri data = intent.getData();
        if (data != null && "routinetracker".equals(data.getScheme())) {
            // Reconstruct the URL for the WebView, transferring the session hash
            String urlStr = data.toString().replace("routinetracker://auth", "https://routine-tracker-ebon.vercel.app/");
            if (webView != null) {
                webView.loadUrl(urlStr);
            }
        } else {
            if (webView != null && webView.getUrl() == null) {
                webView.loadUrl("https://routine-tracker-ebon.vercel.app/");
            }
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "habit-reminders",
                "Habit Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for your scheduled habit reminders");
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public static class NativeNotifBridge {
        private Context context;

        NativeNotifBridge(Context ctx) {
            this.context = ctx;
        }

        @JavascriptInterface
        public boolean isNative() {
            Log.d(TAG, "isNative() called");
            return true;
        }

        @JavascriptInterface
        public void scheduleNotification(String habitId, String habitName, int hour, int minute) {
            Log.d(TAG, ">>> scheduleNotification: " + habitName + " at " + hour + ":" + String.format("%02d", minute));

            try {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) {
                    Log.e(TAG, "AlarmManager is null!");
                    return;
                }

                Intent intent = new Intent(context, NotificationReceiver.class);
                intent.putExtra("habitId", habitId);
                intent.putExtra("habitName", habitName);
                intent.putExtra("hour", hour);
                intent.putExtra("minute", minute);

                int requestCode = Math.abs(habitId.hashCode());
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                java.util.Calendar calendar = java.util.Calendar.getInstance();
                calendar.set(java.util.Calendar.HOUR_OF_DAY, hour);
                calendar.set(java.util.Calendar.MINUTE, minute);
                calendar.set(java.util.Calendar.SECOND, 0);
                calendar.set(java.util.Calendar.MILLISECOND, 0);

                if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
                    calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);
                }

                // Use setExactAndAllowWhileIdle for precise timing on Doze mode
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                } else {
                    alarmManager.setExact(
                        AlarmManager.RTC_WAKEUP,
                        calendar.getTimeInMillis(),
                        pendingIntent
                    );
                }

                Log.d(TAG, ">>> Alarm set for: " + calendar.getTime());



            } catch (Exception e) {
                Log.e(TAG, "scheduleNotification error: " + e.getMessage(), e);
            }
        }

        @JavascriptInterface
        public void cancelNotification(String habitId) {
            try {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) return;
                Intent intent = new Intent(context, NotificationReceiver.class);
                int requestCode = Math.abs(habitId.hashCode());
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                alarmManager.cancel(pendingIntent);
                Log.d(TAG, "Cancelled alarm for: " + habitId);
            } catch (Exception e) {
                Log.e(TAG, "cancelNotification error: " + e.getMessage(), e);
            }
        }

        @JavascriptInterface
        public void skipNotificationToday(String habitId, String habitName, int hour, int minute) {
            Log.d(TAG, ">>> skipNotificationToday: " + habitName);
            try {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) return;
                
                Intent intent = new Intent(context, NotificationReceiver.class);
                intent.putExtra("habitId", habitId);
                intent.putExtra("habitName", habitName);
                intent.putExtra("hour", hour);
                intent.putExtra("minute", minute);

                int requestCode = Math.abs(habitId.hashCode());
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                java.util.Calendar calendar = java.util.Calendar.getInstance();
                calendar.set(java.util.Calendar.HOUR_OF_DAY, hour);
                calendar.set(java.util.Calendar.MINUTE, minute);
                calendar.set(java.util.Calendar.SECOND, 0);
                calendar.set(java.util.Calendar.MILLISECOND, 0);

                // Add 1 day to skip today
                calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "skipNotificationToday error: " + e.getMessage(), e);
            }
        }
    }
}
