@echo off
echo Lancement du nettoyage complet du blog MarocSurf...
echo.

node scripts/clear-articles.mjs
node scripts/build-surf-pages.mjs

echo.
echo Envoi vers GitHub en cours...
git add .
git commit -m "chore: purge totale via script"
git push

echo.
echo Termine avec succes !
pause
