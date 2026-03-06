# SmartLedger 安全性和部署检查清单

## ✅ 已完成的改善

### 🔐 安全性改进
- [x] 移除硬编码的 Gemini API Key（3 个备用Key）
- [x] 移除硬编码的 APP_SECRET (`cxmyydsjjz`)
- [x] 改为只使用环境变量处理敏感信息
- [x] 添加环境变量验证和启动时检查
- [x] 改进错误消息和日志记录

### 📦 Netlify 部署准备
- [x] 创建 `netlify.toml` 构建配置
- [x] 创建 Netlify Functions 版本（`netlify/functions/classify.ts`）
- [x] 添加 CORS 支持和安全头
- [x] 提供本地 Express 服务器备选（开发使用）

### 📚 文档和配置
- [x] 更新 `.env.example` 说明所需环境变量
- [x] 创建完整的 `DEPLOYMENT.md` 部署指南
- [x] 改进 `server.ts` 的配置验证和错误处理

---

## 📋 部署前准备清单

### 本地开发配置
必须完成这些操作，然后才能推送到 Git：

```bash
# 1. 创建本地 .env 文件（不要提交到 Git）
cp .env.example .env

# 2. 从 https://aistudio.google.com/app/apikey 获取 API Key
#    编辑 .env 文件并填入：
#    GEMINI_API_KEY=你的真实API_KEY
#    APP_SECRET=你生成的随机密钥

# ✅ 验证本地开发能工作
npm install
npm run dev

# 测试 API 是否正常
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "input": "花50块买书",
    "secret": "你的APP_SECRET"
  }'
```

### Git 提交前检查
```bash
# ✅ 确保 .env 文件在 .gitignore 中（保存敏感信息）
grep -i ".env" .gitignore

# ✅ 确保没有提交敏感信息
git status

# ✅ 提交安全的配置（不包含真实密钥）
git add . -p  # 交互式添加，避免意外提交
git commit -m "Configure for Netlify deployment"
```

### Netlify 部署配置
```bash
# 1. 连接到 GitHub
#    https://app.netlify.com → Import an existing project

# 2. 在 Netlify 控制面板设置环境变量
#    Site Settings → Environment
#    添加：
#    - GEMINI_API_KEY = 你的真实 Key
#    - APP_SECRET = 你的随机密钥
#    - NODE_ENV = production

# 3. 部署
netlify deploy --prod
```

---

## 🛡️ 安全性关键点

### ⚠️ 永远不要：
- ❌ 提交 `.env` 文件到 Git
- ❌ 在代码注释中写 API Key
- ❌ 硬编码密钥和密码
- ❌ 在前端代码中暴露 APP_SECRET
- ❌ 在公开的地方分享 API Key

### ✅ 应该：
- ✅ 使用环境变量管理所有敏感信息
- ✅ 在 Netlify/服务器上私密存储配置
- ✅ 定期轮换 API Key 和密钥
- ✅ 监控 API 使用情况和配额
- ✅ 实施 API 请求验证（APP_SECRET）

---

## 📊 API 配额监控

### Gemini AI 免费配额
- 每分钟：60 请求
- 每天：1,500 请求
- 建议用于开发/测试

### 生产环境建议
- 升级到付费计划
- 实施请求限流和缓存
- 使用本地分类备选方案
- 定期检查 Google AI 控制面板的使用情况

访问此处查看配额：
https://aistudio.google.com/app/apikey (bottom of the page)

---

## 🔄 定期维护任务

### 每月
- [ ] 检查 API 使用情况和配额
- [ ] 验证 Netlify 日志是否有错误
- [ ] 测试分类功能是否正常工作

### 每季度
- [ ] 轮换 APP_SECRET
- [ ] 检查 Firebase/Firestore 规则是否安全
- [ ] 更新依赖包

### 每年
- [ ] 完整的安全审计
- [ ] 更新部署文档
- [ ] 考虑代码重构和优化

---

## 🚨 故障排除

### 问题：API Key 失效
**症状**：分类失败，错误显示 `API_KEY_INVALID`  
**解决**：
1. 检查 Netlify 环境变量是否已设置
2. 从 https://aistudio.google.com/app/apikey 重新生成 Key
3. 在 Netlify 中更新环境变量

### 问题：配额用尽
**症状**：错误显示 `QUOTA_EXCEEDED`  
**解决**：
1. 等待 24 小时后重试
2. 升级到付费 Google AI 计划
3. 实施缓存和请求限流

### 问题：APP_SECRET 不匹配
**症状**：分类返回 `INVALID_SECRET` 错误  
**解决**：
1. 检查前端发送的密钥
2. 确保 Netlify 环境变量正确设置
3. 查看 Netlify 函数日志

---

## 📞 获取帮助

- Netlify 文档：https://docs.netlify.com
- Google Generative AI：https://ai.google.dev
- 本项目部署指南：`DEPLOYMENT.md`

