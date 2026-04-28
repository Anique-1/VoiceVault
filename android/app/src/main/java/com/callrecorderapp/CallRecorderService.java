package com.callrecorderapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CallRecorderService extends Service {
    private static final String CHANNEL_ID = "CallRecorderChannel";
    private MediaRecorder mediaRecorder;
    private boolean isRecording = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Call Recorder Active")
                .setContentText("Listening for incoming calls")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .build();
        startForeground(1, notification);

        if (intent != null) {
            String action = intent.getAction();
            if ("START_RECORDING".equals(action)) {
                startRecording(intent.getStringExtra("phoneNumber"));
            } else if ("STOP_RECORDING".equals(action)) {
                stopRecording();
            }
        }
        return START_STICKY;
    }

    private void startRecording(String phoneNumber) {
        if (isRecording) return;
        
        try {
            // Update notification
            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("Recording Active")
                    .setContentText("Recording: " + (phoneNumber != null ? phoneNumber : "Current Call"))
                    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                    .setOngoing(true)
                    .build();
            startForeground(1, notification);

            File dir = new File(getExternalFilesDir(null), "CallRecordings");
            if (!dir.exists()) dir.mkdirs();

            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String fileName = "Call_" + (phoneNumber != null ? phoneNumber : "Unknown") + "_" + timeStamp + ".m4a";
            File audioFile = new File(dir, fileName);

            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setOutputFile(audioFile.getAbsolutePath());

            mediaRecorder.prepare();
            mediaRecorder.start();
            isRecording = true;
            Log.d("CallRecorderService", "Recording started: " + audioFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e("CallRecorderService", "Error starting recording", e);
            if (mediaRecorder != null) {
                mediaRecorder.release();
                mediaRecorder = null;
            }
        }
    }

    private void stopRecording() {
        if (isRecording && mediaRecorder != null) {
            try {
                mediaRecorder.stop();
            } catch (Exception e) {
                Log.e("CallRecorderService", "Error stopping recording", e);
            } finally {
                mediaRecorder.release();
                mediaRecorder = null;
                isRecording = false;
                Log.d("CallRecorderService", "Recording stopped.");
                
                // Restore idle notification
                Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setContentTitle("Call Recorder Active")
                        .setContentText("Listening for incoming calls")
                        .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                        .build();
                startForeground(1, notification);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Call Recorder Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopRecording();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
