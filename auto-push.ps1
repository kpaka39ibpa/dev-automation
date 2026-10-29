$commitMsg = Read-Host "Введите описание изменений (коммит)"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "Auto-update: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

git add .
git commit -m "$commitMsg"
git push origin main
Write-Host "✅ Все изменения успешно отправлены на GitHub!" -ForegroundColor Green
