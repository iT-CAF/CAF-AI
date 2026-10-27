@echo off
rem CAF AI - (c) 2026 CAF - iT CAF - by CAF. All rights reserved. See LICENSE.
chcp 65001 >nul
set "CAF_ARGS=%*"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\app\bootstrap.ps1"
