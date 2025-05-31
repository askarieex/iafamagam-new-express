# Clean up
Write-Host "Cleaning npm cache..." -ForegroundColor Green
npm cache clean --force

# Remove node_modules
Write-Host "Removing node_modules directory..." -ForegroundColor Green
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules
}

# Remove .next directory
Write-Host "Removing .next directory..." -ForegroundColor Green
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install

# Run development server
Write-Host "Starting development server..." -ForegroundColor Green
npx next dev 