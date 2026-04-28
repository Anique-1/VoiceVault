package com.callrecorderapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;

public class CallReceiver extends BroadcastReceiver {
    private static int lastState = TelephonyManager.CALL_STATE_IDLE;
    private static boolean isIncoming;
    private static String savedNumber;

    @Override
    public void onReceive(Context context, Intent intent) {
        // Check if service is enabled in SharedPreferences
        boolean isEnabled = context.getSharedPreferences("CallRecorderPrefs", Context.MODE_PRIVATE)
                .getBoolean("isEnabled", false);
        if (!isEnabled) return;

        if (intent.getAction() != null) {
            if (intent.getAction().equals("android.intent.action.NEW_OUTGOING_CALL")) {
                String outNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER);
                if (outNumber != null && !outNumber.isEmpty()) {
                    savedNumber = outNumber;
                }
            } else if (intent.getAction().equals("android.intent.action.PHONE_STATE")) {
                String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
                String number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
                
                if (number != null && !number.isEmpty()) {
                    savedNumber = number;
                }

                int state = 0;
                if (stateStr != null) {
                    if (stateStr.equals(TelephonyManager.EXTRA_STATE_IDLE)) {
                        state = TelephonyManager.CALL_STATE_IDLE;
                    } else if (stateStr.equals(TelephonyManager.EXTRA_STATE_OFFHOOK)) {
                        state = TelephonyManager.CALL_STATE_OFFHOOK;
                    } else if (stateStr.equals(TelephonyManager.EXTRA_STATE_RINGING)) {
                        state = TelephonyManager.CALL_STATE_RINGING;
                    }
                }

                onCallStateChanged(context, state, savedNumber);
            }
        }
    }

    private void onCallStateChanged(Context context, int state, String number) {
        if (lastState == state) {
            return;
        }

        switch (state) {
            case TelephonyManager.CALL_STATE_RINGING:
                isIncoming = true;
                if (number != null && !number.isEmpty()) savedNumber = number;
                break;
            case TelephonyManager.CALL_STATE_OFFHOOK:
                if (lastState != TelephonyManager.CALL_STATE_RINGING) {
                    isIncoming = false;
                    if (number != null && !number.isEmpty()) savedNumber = number;
                }
                
                // Start Recording
                Intent startIntent = new Intent(context, CallRecorderService.class);
                startIntent.setAction("START_RECORDING");
                startIntent.putExtra("phoneNumber", savedNumber != null && !savedNumber.isEmpty() ? savedNumber : "Unknown");
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(startIntent);
                } else {
                    context.startService(startIntent);
                }
                break;
            case TelephonyManager.CALL_STATE_IDLE:
                if (lastState == TelephonyManager.CALL_STATE_RINGING) {
                    // Missed call
                } else if (isIncoming) {
                    // Incoming call ended
                    stopRecording(context);
                } else {
                    // Outgoing call ended
                    stopRecording(context);
                }
                break;
        }
        lastState = state;
    }

    private void stopRecording(Context context) {
        Intent stopIntent = new Intent(context, CallRecorderService.class);
        stopIntent.setAction("STOP_RECORDING");
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(stopIntent);
        } else {
            context.startService(stopIntent);
        }
    }
}
