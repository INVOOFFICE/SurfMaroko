@echo off
chcp 65001 >nul
echo 🌊 Lancement du nettoyage complet du blog MarocSurf...
echo.

:: 1. Réécriture de la base de données JSON depuis Node (zéro erreur d'encodage)
node -e "const fs=require('fs');const db={site:{name:'MoroccoSurf',description:'The Morocco surf blog — spots, seasons, beginner tips.', canonicalOrigin:'https://marocsurf.com', topics:['Spots', 'Beginners', 'Seasons', 'Gear', 'Culture', 'Techniques'], defaultOgImage:'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&h=630&fit=crop&q=80'},articles:[]};const str=JSON.stringify(db,null,2);fs.writeFileSync('surf-news.json',str);fs.writeFileSync('surf-news-latest.json',str);"

echo [1/3] ✅ Bases de donnees JSON (surf-news.json) videes et reinitialisees !

:: 2. Exécution du générateur de site (supprime physiquement les dossiers)
call node scripts\build-surf-pages.mjs
echo [2/3] ✅ Dossiers des anciens articles supprimes localement !

:: 3. Application sur GitHub
echo [3/3] ⏳ Envoi vers GitHub en cours... (patientez)
git add .
git commit -m "chore: purge totale des anciens articles via batch script"
git push

echo.
echo ✅ Mise a jour reussie vers GitHub ! Votre blog est maintenant 100%% vierge.
pause
