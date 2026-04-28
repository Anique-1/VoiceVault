package com.callrecorderapp;

import android.content.Context;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Environment;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.IOException;

public class CallRecorderModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private MediaPlayer mediaPlayer;

    public CallRecorderModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "CallRecorderModule";
    }

    @ReactMethod
    public void toggleService(boolean enable, Promise promise) {
        try {
            // Save state in SharedPreferences
            reactContext.getSharedPreferences("CallRecorderPrefs", Context.MODE_PRIVATE)
                    .edit().putBoolean("isEnabled", enable).apply();

            Intent serviceIntent = new Intent(reactContext, CallRecorderService.class);
            if (enable) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    reactContext.startForegroundService(serviceIntent);
                } else {
                    reactContext.startService(serviceIntent);
                }
            } else {
                reactContext.stopService(serviceIntent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getServiceState(Promise promise) {
        boolean isEnabled = reactContext.getSharedPreferences("CallRecorderPrefs", Context.MODE_PRIVATE)
                .getBoolean("isEnabled", false);
        promise.resolve(isEnabled);
    }

    @ReactMethod
    public void getRecordings(Promise promise) {
        try {
            File dir = new File(reactContext.getExternalFilesDir(null), "CallRecordings");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File[] files = dir.listFiles();
            WritableArray records = Arguments.createArray();
            if (files != null) {
                for (File file : files) {
                    WritableMap map = Arguments.createMap();
                    map.putString("name", file.getName());
                    map.putString("path", file.getAbsolutePath());
                    map.putDouble("size", file.length());
                    records.pushMap(map);
                }
            }
            promise.resolve(records);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void playRecording(String path, Promise promise) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }
            mediaPlayer = new MediaPlayer();
            
            // Ensure audio routes through media speaker
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                mediaPlayer.setAudioAttributes(
                    new android.media.AudioAttributes.Builder()
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .build()
                );
            } else {
                mediaPlayer.setAudioStreamType(android.media.AudioManager.STREAM_MUSIC);
            }

            mediaPlayer.setDataSource(path);
            mediaPlayer.prepare();
            mediaPlayer.start();
            
            mediaPlayer.setOnCompletionListener(mp -> {
                // Could emit event here to React Native
            });
            
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Playback failed: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopPlaying(Promise promise) {
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void pausePlaying(Promise promise) {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void resumePlaying(Promise promise) {
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
            mediaPlayer.start();
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void getPlaybackInfo(Promise promise) {
        if (mediaPlayer != null) {
            try {
                WritableMap map = Arguments.createMap();
                map.putInt("position", mediaPlayer.getCurrentPosition());
                map.putInt("duration", mediaPlayer.getDuration());
                map.putBoolean("isPlaying", mediaPlayer.isPlaying());
                promise.resolve(map);
            } catch (Exception e) {
                promise.resolve(null);
            }
        } else {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void deleteRecording(String path, Promise promise) {
        File file = new File(path);
        if (file.exists() && file.delete()) {
            promise.resolve(true);
        } else {
            promise.reject("ERROR", "Failed to delete file");
        }
    }

    @ReactMethod
    public void isAccessibilityServiceEnabled(Promise promise) {
        int accessibilityEnabled = 0;
        final String service = reactContext.getPackageName() + "/" + WhatsAppAccessibilityService.class.getCanonicalName();
        try {
            accessibilityEnabled = android.provider.Settings.Secure.getInt(
                    reactContext.getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (android.provider.Settings.SettingNotFoundException e) {
            // Ignored
        }
        android.text.TextUtils.SimpleStringSplitter mStringColonSplitter = new android.text.TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = android.provider.Settings.Secure.getString(
                    reactContext.getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        promise.resolve(true);
                        return;
                    }
                }
            }
        }
        promise.resolve(false);
    }

    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Cannot open accessibility settings: " + e.getMessage());
        }
    }
}
