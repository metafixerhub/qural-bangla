package com.banglaquran.audio;

import android.content.Intent;
import android.os.Bundle;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock wakeLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QuranAudio::MainActivityWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        // Configure WebView to keep media playing and register JavaScript Interface
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);

            webView.addJavascriptInterface(new WebAppInterface(), "NativeAudioService");
        }
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void startBackgroundAudio(final String title, final String subtitle) {
            runOnUiThread(() -> {
                if (wakeLock != null && !wakeLock.isHeld()) {
                    wakeLock.acquire(12 * 60 * 60 * 1000L);
                }
                Intent serviceIntent = new Intent(MainActivity.this, BackgroundAudioService.class);
                serviceIntent.setAction(BackgroundAudioService.ACTION_START);
                serviceIntent.putExtra(BackgroundAudioService.EXTRA_TITLE, title);
                serviceIntent.putExtra(BackgroundAudioService.EXTRA_SUBTITLE, subtitle);
                ContextCompat.startForegroundService(MainActivity.this, serviceIntent);
            });
        }

        @JavascriptInterface
        public void stopBackgroundAudio() {
            runOnUiThread(() -> {
                if (wakeLock != null && wakeLock.isHeld()) {
                    wakeLock.release();
                }
                Intent serviceIntent = new Intent(MainActivity.this, BackgroundAudioService.class);
                serviceIntent.setAction(BackgroundAudioService.ACTION_STOP);
                startService(serviceIntent);
            });
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep timers alive so HTML5 audio continues playing in background
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Keep timers alive when screen locks
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        Intent serviceIntent = new Intent(this, BackgroundAudioService.class);
        serviceIntent.setAction(BackgroundAudioService.ACTION_STOP);
        startService(serviceIntent);
        super.onDestroy();
    }
}
