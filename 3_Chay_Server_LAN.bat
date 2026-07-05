@echo off
title SERVER QUAN LY HO SO (LUU DU LIEU)
color 0C
echo ==========================================
echo   DANG KHOI DONG SERVER NOI BO...
echo ==========================================
echo.
echo DUOI DAY LA DIA CHI IP MAY CUA BAN:
ipconfig | findstr "IPv4"
echo.
call npm run server
pause
