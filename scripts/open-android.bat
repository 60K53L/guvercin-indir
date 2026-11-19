@echo off
REM ==========================================================================
REM  Guvercin - Android Emulator launcher
REM  One click: starts the test phone, waits for boot, installs the APK
REM  and opens the app. Run this instead of transferring the APK to a
REM  real phone each time.
REM ==========================================================================

setlocal
set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "EMULATOR=%SDK%\emulator\emulator.exe"
set "ADB=%SDK%\platform-tools\adb.exe"
set "AVD=guvercin"
set "PKG=com.guvercin.soy"

if not exist "%EMULATOR%" (
  echo Android Emulator bulunamadi: %EMULATOR%
  pause
  exit /b 1
)

REM --- Emulator zaten acik mi? ---
"%ADB%" devices | find "emulator-" >nul
if errorlevel 1 (
  echo Emulator baslatiliyor...
  start "" "%EMULATOR%" -avd %AVD% -no-boot-anim -gpu swiftshader_indirect -no-snapshot
  "%ADB%" wait-for-device
  echo Cihaz bekleniyor...
  :wait_boot
  "%ADB%" -s emulator-5554 shell getprop sys.boot_completed 2>nul | find "1" >nul
  if errorlevel 1 (
    ping -n 3 127.0.0.1 >nul
    goto wait_boot
  )
  echo Cihaz acildi.

  REM --- Emulator ayarlari (testi kolaylastirir) ---
  REM 1) stylus_handwriting: emulator "Try out your stylus" ekraninda
  REM    takilip KLAVYE ACMIYORDU. Kapatiyoruz.
  REM 2) show_ime_with_hard_keyboard=0: yazili (dokunmatik) klavye
  REM    gosterilmez, bilgisayar klavesi dogrudan uygulamaya yazar.
  "%ADB%" -s emulator-5554 shell settings put secure stylus_handwriting_enabled 0
  "%ADB%" -s emulator-5554 shell settings put secure show_ime_with_hard_keyboard 0
  "%ADB%" -s emulator-5554 shell am force-stop com.android.inputmethod.latin
) else (
  echo Emulator zaten acik.
)

REM --- APK guncel mi? ---
set "SRC=%~dp0..\android\app\build\outputs\apk\debug\app-debug.apk"
if exist "%SRC%" (
  echo Uygulama kuruluyor...
  "%ADB%" -s emulator-5554 install -r "%SRC%" >nul
  echo Kuruldu.
) else (
  echo Uygulama derlenmemis. Once "npm run mobile:apk" calistir.
)

REM --- Uygulamayi ac ---
"%ADB%" -s emulator-5554 shell monkey -p %PKG% -c android.intent.category.LAUNCHER 1 >nul 2>&1
echo Guvercin acildi.
echo Canli emulasyon ve log takibi baslatildi...
"%ADB%" -s emulator-5554 logcat -v time *:E