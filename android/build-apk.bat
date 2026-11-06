@echo off
setlocal

:: Set JAVA_HOME to installed Eclipse Adoptium JDK 17
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ==============================================
echo Building ASLI KAATA Customer App Debug APK...
echo JAVA_HOME = %JAVA_HOME%
echo ==============================================

call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo BUILD SUCCESS!
    echo APK Location:
    echo app\build\outputs\apk\debug\app-debug.apk
    echo =======================================================
) else (
    echo.
    echo Build failed. If it asks for Android SDK:
    echo 1. Install Android Studio or Android SDK
    echo 2. Ensure android\local.properties points to your SDK path
)

pause

