@echo off
title TAO FILE CAI DAT (BUILD EXE)
color 0F
echo ==========================================
echo   DANG DONG GOI UNG DUNG THANH FILE .EXE
echo   Qua trinh nay co the mat 3-5 phut...
echo   Vui long khong tat cua so nay.
echo ==========================================
call npm run electron:build
echo.
echo ==========================================
echo   DA XONG!
echo   Kiem tra file cai dat tai thu muc: release/
echo ==========================================
pause
