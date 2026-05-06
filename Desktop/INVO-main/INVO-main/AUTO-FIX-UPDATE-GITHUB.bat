@echo off
chcp 65001 >nul
setlocal

cd /d "C:\Users\M2B PRO\Desktop\GITHUB\INVO\offline2" || (
  echo [ERREUR] Dossier introuvable.
  pause & exit /b 1
)

where git >nul 2>&1 || (
  echo [ERREUR] Git n'est pas dans le PATH.
  pause & exit /b 1
)

echo ============================
echo   AUTO FIX + UPDATE GITHUB
echo ============================
echo ATTENTION : annule rebase en cours et SUPPRIME toutes les
echo             modifications NON COMMITEES ^(comme git reset --hard^).
echo.

:: Sortir d'un rebase / merge bloque (sans erreur si rien en cours)
git rebase --abort >nul 2>&1
git merge --abort >nul 2>&1

:: Revenir a l'etat du dernier commit local (perd les modifs non commit)
git reset --hard HEAD >nul 2>&1

git fetch origin
if errorlevel 1 (
  echo [ERREUR] fetch impossible ^(connexion / remote^).
  pause & exit /b 1
)

git checkout main
if errorlevel 1 (
  echo [ERREUR] Branche main introuvable. Creez-la ou adaptez le script.
  pause & exit /b 1
)

git pull origin main
if errorlevel 1 (
  echo [ERREUR] pull impossible ^(conflits ou historique^). Corrigez avec Git puis relancez.
  pause & exit /b 1
)

git branch --set-upstream-to=origin/main main >nul 2>&1

git add -A

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "update auto"
  if errorlevel 1 (
    echo [ERREUR] Echec du commit ^(hooks, identite git, etc.^).
    pause & exit /b 1
  )
) else (
  echo [INFO] Rien a commiter ^(aucun changement dans les fichiers^).
)

git push -u origin main
if errorlevel 1 (
  echo [ERREUR] Push refuse ^(droits, auth, historique^).
  pause & exit /b 1
)

echo.
echo OK - Mise a jour terminee ^(origin/main^).
echo https://github.com/INVOOFFICE/INVO
echo.
pause
endlocal
