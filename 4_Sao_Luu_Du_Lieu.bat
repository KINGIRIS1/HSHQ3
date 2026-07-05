@echo off
title SAO LUU DU LIEU
color 0E
echo ==========================================
echo   DANG SAO LUU DU LIEU (BACKUP)...
echo ==========================================
if exist "server\db.json" (
    copy "server\db.json" "server\db_backup_thu_cong.json"
    echo.
    echo [OK] Da sao luu thanh cong thanh file: server\db_backup_thu_cong.json
    echo Ban co the doi ten file nay de luu tru lau dai.
) else (
    echo [LOI] Khong tim thay file du lieu server\db.json
)
echo.
pause
