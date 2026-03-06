# SmartLedger Netlify PWA 部署指南

## 🎯 概述
本指南说明如何将 SmartLedger 作为 PWA（离线应用）部署到 Netlify，并安全地配置 Gemini AI 功能。

---

## ⚠️ 安全改进说明

### 之前的问题
项目原本包含**硬编码的 API Key 和应用密钥**在代码中：
- ❌ 3 个备用的 Gemini API Key
- ❌ 明文的 APP_SECRET (`cxmyydsjjz`)

这些敏感信息**不应该出现在源代码中**，会带来严重的安全隐患。

### 已修复项
✅ 所有 API Key 改为环境变量  
✅ APP_SECRET 改为环境变量  
✅ 创建了 Netlify Functions 版本（无需持久服务器）  
✅ 添加了完整的验证和错误处理  

---

## 📋 部署前准备

### 1. 获取 Gemini API Key
1. 访问 https://aistudio.google.com/app/apikey
2. 登录您的 Google 账号
3. 点击 "Create API Key"
4. 复制生成的 API Key（妥善保存）

### 2. 配置本地环境变量

创建或编辑 `.env` 文件：
```env
GEMINI_API_KEY=your_actual_api_key_here
APP_SECRET=your_secure_random_secret_here
NODE_ENV=development
PORT=3000
```

**生成安全的 APP_SECRET：**
```bash
# 在终端运行以生成随机密钥
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. 更新 package.json 依赖

确保已安装 Netlify Functions 所需的依赖：
```bash
npm install --save-dev @netlify/functions
```

---

## 🚀 Netlify 部署步骤

### 方式 1: GitHub 集成（推荐）

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Configure for Netlify deployment"
   git push origin main
   ```

2. **在 Netlify 关联仓库**
   - 访问 https://app.netlify.com
   - 点击 "Add New Site" → "Import an existing project"
   - 选择 GitHub 仓库

3. **设置构建配置**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Deploy site"

### 方式 2: 手动部署

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

---

## 🔐 Netlify 环境变量设置

部署后，在 Netlify 控制面板配置环境变量：

1. 进入您的站点
2. Site settings → Environment
3. 点击 "Add a variable" 添加以下变量：

| 变量名 | 值 | 说明 |
|-------|-----|------|
| `GEMINI_API_KEY` | 你的API Key | 从 aistudio.google.com 复制 |
| `APP_SECRET` | 随机生成的密钥 | 用于验证 API 请求 |
| `NODE_ENV` | `production` | 生产环境标志 |

### ⚠️ 重要
不要将这些值提交到 Git！Netlify 环境变量是私密的，不会暴露给客户端。

---

## 📁 项目结构变更

```
smartledger/
├── netlify/
│   └── functions/
│       └── classify.ts          # Netlify 函数（替代 Express）
├── .env.example                 # 环境变量示例（仅参考）
├── netlify.toml                 # Netlify 配置
├── server.ts                    # 本地开发用 Express 服务器
├── package.json
└── ...
```

---

## 🛠️ 本地开发

```bash
# 使用本地 Express 服务器开发
npm run dev

# 或使用 Netlify CLI 模拟部署环境
netlify dev
```

---

## ✅ 功能说明

### 智能分类
- **AI 模式**：优先使用 Gemini AI 智能分类
- **备选方案**：AI 失败时自动使用本地关键词匹配
- **状态标志**：
  - `_isFallback: true` - 使用了备选方案
  - `_isSmartFallback: true` - 备选方案识别得很好

### API 错误处理

| 错误 | 原因 | 解决方案 |
|------|-----|--------|
| `API_KEY_MISSING` | 未配置 API Key | 在 Netlify 环境变量中设置 `GEMINI_API_KEY` |
| `API_KEY_INVALID` | API Key 过期或无效 | 检查 Key 是否正确，从 aistudio.google.com 重新生成 |
| `QUOTA_EXCEEDED` | 请求配额用尽 | 等待 24 小时，或升级 Google AI 计划 |
| `INVALID_SECRET` | 验证失败 | 检查 APP_SECRET 值 |

---

## 🔍 调试

### 查看 Netlify 日志
```bash
netlify logs --tail
```

### 本地测试分类端点

```bash
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "input": "花了50块钱在麦当劳吃汉堡",
    "secret": "你的APP_SECRET"
  }'
```

---

## 📊 监控和维护

### API 额度管理
- Gemini 免费额度：每分钟 60 请求，每天 1500 请求
- 生产环境建议：升级到付费计划或实施请求限流

### 环境变量轮换
定期更新 `APP_SECRET`：
1. 生成新的密钥
2. 在 Netlify 更新变量
3. 测试应用确保正常
4. 记录在安全的地方

---

## 🚨 常见问题

**Q: API Key 暴露怎么办？**  
A: 立即在 https://aistudio.google.com/app/apikey 重新生成，然后在 Netlify 更新。

**Q: 如何在前端隐藏 APP_SECRET？**  
A: APP_SECRET 不应在前端代码中硬编码。改为：
   - 从后端获取配置
   - 使用 Session 或 JWT 认证
   - 实现请求签名验证

**Q: 能否在自己的服务器运行？**  
A: 可以，使用 `npm run dev` 或修改 `server.ts` 部署到自己的 Node 服务器。

---

## 📚 相关资源

- Netlify Functions 文档: https://docs.netlify.com/functions/overview/
- Google Generative AI: https://ai.google.dev/
- PWA 指南: https://web.dev/progressive-web-apps/

