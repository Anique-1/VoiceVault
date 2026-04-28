package com.callrecorderapp;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Log;

public class WhatsAppAccessibilityService extends AccessibilityService {
    private static final String TAG = "WhatsAppAccService";
    private boolean isCallActive = false;
    private boolean wasSpeakerphoneOn = false;
    private AudioManager audioManager;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        Log.d(TAG, "WhatsApp Accessibility Service Connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        
        String packageName = event.getPackageName().toString();
        
        // We only care about WhatsApp and WhatsApp Business
        if (!packageName.equals("com.whatsapp") && !packageName.equals("com.whatsapp.w4b")) return;

        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        boolean foundCallIndicator = false;

        // HEURISTIC 1: Check if AudioManager is in communication mode (most reliable for VoIP)
        if (audioManager != null && audioManager.getMode() == AudioManager.MODE_IN_COMMUNICATION) {
            foundCallIndicator = true;
        }

        // HEURISTIC 2: Detect ongoing call by looking for common UI elements
        if (!foundCallIndicator && (
            findNodeByTextOrContentDescription(rootNode, "End call") != null || 
            findNodeByTextOrContentDescription(rootNode, "End video call") != null ||
            findNodeByViewId(rootNode, "com.whatsapp:id/call_duration") != null ||
            findNodeByViewId(rootNode, "com.whatsapp:id/voice_note_duration_text") != null)) {
            foundCallIndicator = true;
        }

        if (foundCallIndicator && !isCallActive) {
            isCallActive = true;
            Log.d(TAG, "WhatsApp Call Started Detected");
            
            // Just enable speakerphone and let the Service handle the retries
            if (audioManager != null) {
                wasSpeakerphoneOn = audioManager.isSpeakerphoneOn();
                audioManager.setSpeakerphoneOn(true);
            }

            // Small delay to let audio routing switch before recording starts
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                Intent startIntent = new Intent(this, CallRecorderService.class);
                startIntent.setAction("START_RECORDING");
                startIntent.putExtra("phoneNumber", "WhatsApp_Call");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(startIntent);
                } else {
                    startService(startIntent);
                }
            }, 300);

        } else if (!foundCallIndicator && isCallActive) {
            isCallActive = false;
            Log.d(TAG, "WhatsApp Call Ended Detected");
            
            // Restore speakerphone and mode
            if (audioManager != null) {
                audioManager.setSpeakerphoneOn(wasSpeakerphoneOn);
                audioManager.setMode(AudioManager.MODE_NORMAL);
                audioManager.abandonAudioFocus(null);
            }

            // Stop recording
            Intent stopIntent = new Intent(this, CallRecorderService.class);
            stopIntent.setAction("STOP_RECORDING");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(stopIntent);
            } else {
                startService(stopIntent);
            }
        }
    }

    private AccessibilityNodeInfo findNodeByTextOrContentDescription(AccessibilityNodeInfo node, String text) {
        if (node == null) return null;
        
        if (text.equals(node.getText()) || text.equals(node.getContentDescription())) {
            return node;
        }
        
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo result = findNodeByTextOrContentDescription(node.getChild(i), text);
            if (result != null) return result;
        }
        
        return null;
    }

    private AccessibilityNodeInfo findNodeByViewId(AccessibilityNodeInfo node, String viewId) {
        if (node == null) return null;
        
        if (viewId.equals(node.getViewIdResourceName())) {
            return node;
        }
        
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo result = findNodeByViewId(node.getChild(i), viewId);
            if (result != null) return result;
        }
        
        return null;
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility Service Interrupted");
    }
}
