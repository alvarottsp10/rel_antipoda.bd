@echo off
chcp 65001 >nul
title Folha de Controlo de Obra - Instalador

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   📋 FOLHA DE CONTROLO DE OBRA - INSTALADOR                  ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar se Node.js está instalado
echo [1/5] A verificar Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERRO: Node.js não está instalado!
    echo.
    echo Por favor, instale o Node.js primeiro:
    echo    1. Vá a https://nodejs.org/
    echo    2. Descarregue a versão LTS
    echo    3. Execute o instalador
    echo    4. Execute este script novamente
    echo.
    pause
    exit /b 1
)
echo    ✅ Node.js instalado: 
node --version

:: Verificar npm
echo.
echo [2/5] A verificar npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERRO: npm não encontrado!
    pause
    exit /b 1
)
echo    ✅ npm instalado:
npm --version

:: Instalar dependências
echo.
echo [3/5] A instalar dependências...
echo    Isto pode demorar alguns minutos...
cd /d "%~dp0servidor"
call npm install
if %errorlevel% neq 0 (
    echo ❌ ERRO: Falha ao instalar dependências!
    pause
    exit /b 1
)
echo    ✅ Dependências instaladas

:: Verificar se .env existe
echo.
echo [4/5] A verificar configuração...
if not exist ".env" (
    echo    A criar ficheiro .env...
    (
        echo PORT=3000
        echo HOST=0.0.0.0
        echo JWT_SECRET=antipoda_secret_%random%%random%
        echo DB_PATH=./database.sqlite
    ) > .env
    echo    ✅ Ficheiro .env criado
) else (
    echo    ✅ Ficheiro .env já existe
)

:: Concluir
echo.
echo [5/5] Instalação concluída!
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                       ║
echo ║                                                              ║
echo ║   Para iniciar o servidor:                                   ║
echo ║      1. Abra uma linha de comandos                          ║
echo ║      2. Navegue até: %~dp0servidor                           ║
echo ║      3. Execute: npm start                                   ║
echo ║                                                              ║
echo ║   Ou execute o ficheiro: iniciar-servidor.bat                ║
echo ║                                                              ║
echo ║   Login inicial:                                             ║
echo ║      Utilizador: admin                                       ║
echo ║      Password: admin123                                      ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
