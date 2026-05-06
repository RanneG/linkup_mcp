@echo off
REM Stitch app launchers moved to stitch-app repo.
cd /d "%~dp0"
set "STITCH_APP=%~dp0..\stitch-app\Stitch.bat"
if exist "%STITCH_APP%" (
  echo [deprecated] Launching Stitch from stitch-app repo...
  call "%STITCH_APP%" %*
  exit /b %errorlevel%
)
echo Stitch launchers now live in the stitch-app repo.
echo Clone https://github.com/RanneG/stitch-app beside this repo, then run ..\stitch-app\Stitch.bat
pause
