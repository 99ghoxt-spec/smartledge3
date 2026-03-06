import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const CATEGORIES = [
  "餐饮美食", "交通出行", "购物消费", "休闲娱乐", "医疗保健", 
  "生活日用", "住房缴费", "工资收入", "理财收益", "其他"
];

async function startServer() {
  console.log("Starting SmartLedger Backend Server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasApiKey: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
      env: process.env.NODE_ENV
    });
  });

  // AI Classification API Endpoint (Server-side)
  app.post("/api/classify", async (req, res) => {
    console.log("Received classification request:", req.body);
    const { input, secret } = req.body;
    
    // 准备有效的“钥匙”：环境变量、用户提供、原始模板
    const keys = [
      process.env.GEMINI_API_KEY || process.env.API_KEY,
      "AIzaSyAmUKHhmXkzZyingULB7ilvTsjavMRg9cE", 
      "AIzaSyCGvihtHtT14G1JnC21_dy60FEG7drCC60"
    ].filter(Boolean).map(k => k.trim()).filter(k => !k.includes("_X_z_")) as string[];

    const APP_SECRET = "cxmyydsjjz";

    if (!input) {
      return res.status(400).json({ error: "INPUT_EMPTY" });
    }

    if (secret !== APP_SECRET) {
      console.warn("Invalid secret attempt:", secret);
      return res.status(403).json({ error: "INVALID_SECRET" });
    }

    if (keys.length === 0) {
      console.error("No API keys available");
      return res.status(500).json({ 
        error: "API_KEY_MISSING", 
        message: "服务器未检测到任何有效的 API Key。" 
      });
    }

    let lastError: any = null;
    for (const key of keys) {
      // 过滤掉明显的占位符
      if (key.includes("your_api_key_here") || key.includes("TODO")) continue;

      try {
        console.log(`Trying Gemini AI with key starting with ${key.substring(0, 8)}...`);
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash-latest", // 使用最新的 1.5 Flash 稳定版
          contents: [{ parts: [{ text: `你是一个专业的记账助手。请解析以下支付或收入信息，提取金额、类型（收入或支出）、分类和简短描述。
          
          注意：在“描述”字段中，请优先提取消费的对象主体（例如：麦当劳、食堂、希尔顿酒店、滴滴打车、发工资等），而不是重复整个句子。
          
          可选分类包括: ${CATEGORIES.join(", ")}。
          
          输入信息: "${input}"
          
          请严格按照 JSON 格式返回，包含 amount (数字), type (income 或 expense), category (字符串), description (字符串) 字段。` }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, description: "金额" },
                type: { type: Type.STRING, enum: ["income", "expense"], description: "类型: income 或 expense" },
                category: { type: Type.STRING, description: "分类" },
                description: { type: Type.STRING, description: "消费对象主体或简短描述" }
              },
              required: ["amount", "type", "category", "description"]
            }
          }
        });

        const result = JSON.parse(response.text || "{}");
        console.log("Classification successful via AI");
        return res.json(result);
      } catch (error: any) {
        console.warn(`Key starting with ${key.substring(0, 8)} failed:`, error.message);
        lastError = error;
        // 如果是 429 (额度)、400 (无效Key) 或 500 (服务器忙)，继续尝试下一个 Key
        const shouldRetry = error.message?.includes("quota") || error.message?.includes("429") || error.status === 429 ||
                            error.message?.includes("API key not valid") || error.status === 400 ||
                            error.status >= 500;
        if (!shouldRetry) break;
        
        // 增加 1-2 秒随机延迟，避开瞬时频率限制
        const jitter = Math.floor(Math.random() * 1000);
        await new Promise(resolve => setTimeout(resolve, 1000 + jitter));
      }
    }

    // --- 本地兜底逻辑 (当所有 AI Key 都失败时触发) ---
    console.warn("All Gemini keys failed or quota exceeded. Using local fallback parser.");
    
    // 简单的正则提取金额
    const amountMatch = input.match(/(\d+(\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
    
    // 简单的关键词判断类型
    let type = "expense";
    if (input.includes("收") || input.includes("进账") || input.includes("发工资") || input.includes("收入") || input.includes("红")) {
      type = "income";
    }
    
    // 简单的关键词判断分类
    let category = "其他";
    const inputLower = input.toLowerCase();
    
    // 餐饮美食
    if (inputLower.match(/吃|饭|餐|奶茶|咖啡|麦当劳|肯德基|汉堡|火锅|面|食堂|饿了么|美团|早|午|晚|宵夜/)) {
      category = "餐饮美食";
    }
    // 交通出行
    else if (inputLower.match(/车|打的|地铁|油|公交|滴滴|打车|机票|火车|高铁|加油/)) {
      category = "交通出行";
    }
    // 购物消费
    else if (inputLower.match(/买|购|超市|淘宝|京东|拼多多|衣服|鞋|手机|数码|商场|便利店/)) {
      category = "购物消费";
    }
    // 休闲娱乐
    else if (inputLower.match(/玩|电影|游戏|网吧|KTV|旅游|门票|酒吧|足浴|按摩/)) {
      category = "休闲娱乐";
    }
    // 住房缴费
    else if (inputLower.match(/房租|水电|煤气|燃气|宽带|物业|话费|网费/)) {
      category = "住房缴费";
    }
    // 工资收入
    else if (inputLower.match(/工资|奖金|兼职|报销|分红/)) {
      category = "工资收入";
    }
    // 医疗保健
    else if (inputLower.match(/医|药|院|体检|感冒|挂号/)) {
      category = "医疗保健";
    }
    
    // 尝试提取消费主体作为描述
    let description = input;
    const subjects = ["麦当劳", "肯德基", "汉堡王", "食堂", "超市", "便利店", "滴滴", "打车", "地铁", "公交", "房租", "水电", "工资", "奖金", "希尔顿", "酒店", "淘宝", "京东", "美团", "饿了么"];
    for (const s of subjects) {
      if (input.includes(s)) {
        description = s;
        break;
      }
    }
    // 如果没匹配到，尝试去掉“花了”、“收了”等词
    if (description === input) {
      description = input.replace(/花了|收了|收入|支出|了|元|块/g, "").trim();
    }
    
    return res.json({
      amount,
      type,
      category,
      description: description.length > 20 ? description.substring(0, 20) : description,
      _isFallback: true,
      _isSmartFallback: category !== "其他" // 如果识别出了分类，就标记为智能兜底
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
