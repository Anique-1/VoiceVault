@echo off
echo ========================================================
echo Building VoiceVault App (Release Version 1.0.0)
echo ========================================================
echo.
echo Cleaning old build files...
cd android
call gradlew clean

echo.
echo Compiling the Android APK...
call gradlew assembleRelease

cd ..
echo.
echo ========================================================
echo Copying the final APK to the main folder...
echo ========================================================
copy "android\app\build\outputs\apk\release\app-release.apk" "VoiceVault_v1.0.0.apk" /Y

echo.
echo ========================================================
echo BUILD COMPLETE! 
echo You can now send "VoiceVault_v1.0.0.apk" to your phone to install it.
echo ========================================================
pause
