@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem ============================================================
rem  Mise a jour GitHub : INVOOFFICE/INVO
rem  Depôt : https://github.com/INVOOFFICE/INVO
rem ============================================================

set "REPO_DIR=C:\Users\M2B PRO\Desktop\GITHUB\INVO\offline2"
set "REMOTE_URL=https://github.com/INVOOFFICE/INVO.git"
set "BRANCH=main"

cd /d "%REPO_DIR%" || (
  echo [ERREUR] Dossier introuvable : %REPO_DIR%
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Git n'est pas installe ou pas dans le PATH.
  echo Installez Git : https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo [INFO] Pas de depot Git ici — initialisation...
  git init
  git branch -M %BRANCH%
  git remote add origin "%REMOTE_URL%"
  echo [OK] Remote origin = %REMOTE_URL%
) else (
  git remote get-url origin >nul 2>&1
  if errorlevel 1 (
    echo [INFO] Ajout du remote origin...
    git remote add origin "%REMOTE_URL%"
  )
)

echo.
echo --- Statut avant mise a jour ---
git status -sb
echo.

set /p COMMIT_MSG=Message de commit (Entree = "Mise a jour %date%") : 
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=Mise a jour %date%"

git add -A
git status -sb

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "!COMMIT_MSG!"
  if errorlevel 1 (
    echo [ERREUR] Echec du commit.
    pause
    exit /b 1
  )
) else (
  echo [INFO] Rien a commiter — le working tree est deja propre.
)

echo.
echo --- Synchronisation avec GitHub (branche %BRANCH%) ---
git fetch origin 2>nul
git pull --rebase origin %BRANCH% 2>nul
if errorlevel 1 (
  echo [ATTENTION] pull / rebase a echoue ou pas de branche distante encore — tentative de push quand meme...
)

git push -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo [ERREUR] Push refuse. Verifiez :
  echo   - Connexion Internet
  echo   - Droits sur le depot GitHub ^(token / SSH^)
  echo   - Que la branche distante s'appelle bien "%BRANCH%"
  pause
  exit /b 1
)

echo.
echo [OK] Depot a jour : https://github.com/INVOOFFICE/INVO
pause
endlocal
