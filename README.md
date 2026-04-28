# VoiceVault - Advanced Call Recorder 🎙️

VoiceVault is a premium, high-quality SIM call recording application built with React Native and native Android Java modules. It features a stunning modern UI, background service recording, and an integrated audio player.

## 🚀 Features
*   **High-Quality Recording:** Utilizes Android's `VOICE_COMMUNICATION` audio source to clearly record both sides of standard SIM phone calls.
*   **Foreground Service:** Runs a persistent background service ensuring recordings are captured reliably even when the app is closed.
*   **Premium Interface:** A beautiful Magenta and Crimson Red theme featuring a card-based recording list and a dynamic circular toggle button.
*   **Inline Audio Player:** Play back your recordings instantly with a smooth, live-updating progress scrubber and intuitive controls.
*   **Local Storage:** All recordings are stored securely on your local device.

## 🛠 Tech Stack
*   **Frontend:** React Native (TypeScript), React Hooks, Animated API
*   **Native Bridge:** Java (Android Native Modules)
*   **Audio Engine:** `MediaRecorder` for capture, `MediaPlayer` for playback

## 📱 How to Build (APK)
A handy automated script is provided to generate a production-ready APK in seconds!
1. Double-click the `build_apk.bat` file in the root directory.
2. The script will automatically clean the gradle cache, assemble the Release version, and copy the final output.
3. Your final installable app will appear in the root folder as **`VoiceVault_v1.0.1.apk`**.

## 💻 Development
To run the app locally on an emulator or connected device:

1. Install dependencies:
```bash
npm install
```

2. Run on Android:
```bash
npx react-native run-android
```

## 🔒 Permissions
VoiceVault requires the following Android permissions to function:
*   `RECORD_AUDIO` - To capture the call audio.
*   `READ_PHONE_STATE` - To detect when a phone call starts and ends.
*   `READ_CALL_LOG` - Required by modern Android versions to process incoming/outgoing call states.
*   `POST_NOTIFICATIONS` - To display the persistent background recording notification.
