@echo off
setlocal EnableExtensions

REM ==================================================
REM WAAPPLY - Upload ONLY ai-news project files
REM Target repo: https://github.com/INVOOFFICE/WAAPPLY
REM ==================================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/INVOOFFICE/WAAPPLY.git"
set "BRANCH=main"

if "%~1"=="" (
  set "COMMIT_MSG=chore: update ai-news project"
) else (
  set "COMMIT_MSG=%~1"
)

echo.
echo [1/8] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git not found in PATH.
  pause
  exit /b 1
)

echo [2/8] Checking repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: This folder is not inside a Git repository.
  pause
  exit /b 1
)

echo [3/8] Setting origin...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

echo [4/8] Staging ONLY ai-news project paths...
git add -A "index.html" "article.html" "style.css" "main.js" "news.json" "sitemap.xml" "feed.xml" "robots.txt" "contact.html" "privacy-policy.html" "terms-of-use.html" "upload-github.bat" "upload-ai-news-only.bat"
git add -A "scripts"
git add -A "ai-news-blog"
git add -A "articles"

echo [5/8] Optional status preview:
git status --short

echo [6/8] Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo No new ai-news changes to commit. Will still try push.
)

echo [7/8] Branch...
git branch -M %BRANCH%

echo [8/8] Push...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo Push failed. Check GitHub auth/permissions.
  pause
  exit /b 1
)

echo.
echo Success. Uploaded ai-news project only.
echo Repo: https://github.com/INVOOFFICE/WAAPPLY
pause

