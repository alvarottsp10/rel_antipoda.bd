@echo off
chcp 65001 >nul
title Folha de Controlo de Obra - Servidor

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   📋 FOLHA DE CONTROLO DE OBRA - SERVIDOR                    ║
echo ║                                                              ║
echo ║   A iniciar servidor...                                      ║
echo ║   Pressione Ctrl+C para parar                                ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0servidor"

:: Verificar se node_modules existe
if not exist "node_modules" (
    echo ⚠️  Dependências não instaladas. A instalar...
    call npm install
)

:: Iniciar servidor
node server.js

:: Se chegou aqui, o servidor parou
echo.
echo Servidor parado.
pause
