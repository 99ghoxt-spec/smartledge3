# SmartLedge3 Netlify 部署指南

## 问题

smartledge3 安智能账本已经在 GitHub 上（https://github.com/99ghoxt-spec/smartledge3），但 Netlify 项目 `inquisitive-dodol-971969` 还没有与这个新仓库关联。

##解决方案

### 步骤 1: 打开 Netlify Dashboard
访问：https://app.netlify.com/sites/inquisitive-dodol-971969/overview

### 步骤 2: 进入 Build & Deploy 设置
1. 点击左侧菜单 **Site settings**
2. 找到 **Build & deploy** 部分
3. 点击 **Repository** 子菜单

### 步骤 3: 重新连接 GitHub 仓库
1. 在 **Repository** 下，找到 **Continuous deployment**
2. 如果现在链接的不是 smartledge3，点击 **Disconnect** 按钮
3. 点击 **Connect repository**
4. 选择 GitHub
5. 授权 Netlify 访问 GitHub
6. 找到并选择：`99ghoxt-spec/smartledge3`
7. 选择分支：`main`

### 步骤 4: 验证构建设置
在 **Build & deploy** > **Build settings** 中，确认：

- **Build command**: `npm install && npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions` ✓ (重要！这样才能部署 AI 分类 API)
- **Base directory**: (留空)

### 步骤 5: 配置环境变量
在 **Build & deploy** > **Environment** 中，确保有两个变量：

```
GEMINI_API_KEY = <你的 Gemini API Key>
APP_SECRET = <你的应用密钥>
```

### 步骤 6: 触发部署
1. 返回 **Deployments** 标签页
2. 点击 **Trigger deploy** 按钮
3. 选择 **Deploy site**
4. 等待 2-3 分钟完成

## 验证部署

部署完成后，检查：

1. **静态网站**: https://inquisitive-dodol-971969.netlify.app
2. **API 端点**: 在应用中使用 AI 分类功能（手机端）

如果手机端仍然报 `API_KEY_MISSING`，可能需要：
- 刷新浏览器（Ctrl+Shift+R 清除缓存）
- 等待 Functions 完全部署（通过 Netlify UI 的 Deploys 标签页查看日志）

## 快速检查命令

```powershell
# 测试 API 是否在线
curl https://inquisitive-dodol-971969.netlify.app/.netlify/functions/classify
```

## 自动重新部署

一旦 GitHub 仓库连接完成，以后每次在 `smartledge3` 仓库的 `main` 分支 push 代码，Netlify 会自动：
1. 拉取最新代码
2. 运行 `npm install && npm run build`
3. 部署 `dist/` 文件夹
4. 部署 `netlify/functions/` 中的函数

所有这一切都会自动进行，无需手动干预！
