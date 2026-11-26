@echo off
rem One sync pass, for Windows Task Scheduler (see sync/README.md).
rem Output is added to agent.log next to this file.
cd /d "%~dp0"
set "NODE=node"
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
"%NODE%" agent.mjs --once >> agent.log 2>&1
