@echo off
cd /d "C:\Users\ADMIN\Desktop\ithumba 1"
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/mikebarack-dev/ithumba-materials.git
git push -u origin main
pause
