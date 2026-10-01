@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title PL-Life Stage48 - Isolated Native Recovery Acceptance
set "PL_SYNTHETIC_REPORT_DIR=%~dp0stage48-evidence"
if not exist "index.html" goto missing_project
if not exist ".github\pl-ci\round187-native-fullapp-restore-browser.py" goto missing_project
set "PY=py -3"
py -3 --version >nul 2>nul
if errorlevel 1 set "PY=python"
%PY% --version >nul 2>nul
if errorlevel 1 goto missing_python
%PY% -c "import playwright" >nul 2>nul
if not errorlevel 1 goto check_browser

echo.
echo Playwright 1.55.0 is not installed for this Python interpreter.
echo Installing this test-only dependency requires internet and your approval.
choice /c YN /n /m "Install Playwright for your current user? [Y/N] "
if errorlevel 2 goto missing_playwright
%PY% -m pip install --user --disable-pip-version-check playwright==1.55.0
if errorlevel 1 goto failed_dependency
:check_browser
echo.
echo Test requires Playwright Chromium. If already installed, this checks it.
echo Browser installation may download files; no installed browser settings are changed.
choice /c YN /n /m "Check/install test Chromium? [Y/N] "
if errorlevel 2 goto run_test
%PY% -m playwright install chromium
if errorlevel 1 goto failed_dependency
:run_test
if not exist "%PL_SYNTHETIC_REPORT_DIR%" mkdir "%PL_SYNTHETIC_REPORT_DIR%"
echo.
echo Running against a fresh 127.0.0.1 origin and fictitious test records only.
echo No personal ZIP, production site, test site, or existing browser profile is used.
echo.
%PY% ".github\pl-ci\round187-native-fullapp-restore-browser.py" > "%PL_SYNTHETIC_REPORT_DIR%\round187-console.log" 2>&1
set "RUN_EXIT=%ERRORLEVEL%"
type "%PL_SYNTHETIC_REPORT_DIR%\round187-console.log"
echo.
echo Result JSON: "%PL_SYNTHETIC_REPORT_DIR%\round187-evidence\round187-result.json"
echo Log: "%PL_SYNTHETIC_REPORT_DIR%\round187-console.log"
if not "%RUN_EXIT%"=="0" goto failed_test
echo PASS: native full-app restore test completed. Device acceptance is still separate.
goto done
:missing_project
echo Missing full project files. Extract the COMPLETE Stage48 candidate ZIP before running.
goto failed
:missing_python
echo Python 3 was not found. Install Python 3, then run this file again.
goto failed
:missing_playwright
echo Test cannot run without Playwright; no installation was made.
goto failed
:failed_dependency
echo Dependency installation failed. Check your internet connection and Python installation.
goto failed
:failed_test
echo NOT PASSED. Check the result JSON for FAIL or BLOCKED and its last phase.
goto failed
:failed
set "RUN_EXIT=1"
:done
echo.
pause
exit /b %RUN_EXIT%
