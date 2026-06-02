@echo off
title JARVIS MT5 Bridge
color 0A
echo.
echo  ██████████████████████████████████████
echo  █  JARVIS MT5 PYTHON BRIDGE  v1.0   █
echo  ██████████████████████████████████████
echo.
echo  Connecting to MetaTrader 5...
echo  REST API: http://localhost:1234/api/v1/
echo.
echo  Keep this window open while using JARVIS Trading.
echo  Close to disconnect bridge.
echo.
python "%~dp0bridge.py" %*
echo.
echo  Bridge stopped. Press any key to close.
pause >nul
