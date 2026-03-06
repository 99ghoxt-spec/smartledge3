# 测试 Netlify Functions 部署
Write-Host "测试 API 端点..." -ForegroundColor Cyan

$payload = @{
    input = "咖啡"
    secret = "test"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "https://inquisitive-dodol-971969.netlify.app/.netlify/functions/classify" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10
    
    Write-Host "✓ API 返回状态码: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "响应内容:" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "✗ API 请求失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Details: $($_.Exception)" -ForegroundColor Yellow
}

Write-Host "`n测试静态文件..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest `
        -Uri "https://inquisitive-dodol-971969.netlify.app" `
        -TimeoutSec 10
    Write-Host "✓ 网站返回状态码: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ 网站请求失败: $($_.Exception.Message)" -ForegroundColor Red
}
