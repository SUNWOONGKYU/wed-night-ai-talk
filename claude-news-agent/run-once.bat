@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
pushd "%~dp0"
echo [claude-news-agent] running...
python run.py --once
set ERR=%ERRORLEVEL%
popd
if not "%ERR%"=="0" (
    echo.
    echo [ERROR] exit code %ERR%
    pause
) else (
    echo.
    echo Done. Closing in 5s...
    ping -n 6 127.0.0.1 > nul
)
