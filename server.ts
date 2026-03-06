import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const CATEGORIES = [
  "餐饮美食", "交通出行", "购物消费", "休闲娱乐", "医疗保健", 
  "生活日用", "住房缴费", "工资收入", "理财收益", "其他"
];

// Validate required environment variables at startup
function validateConfig() {
  const errors: string[] = [];
  
  if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
    errors.push("Missing GEMINI_API_KEY or API_KEY environment variable");
  }
  
  if (!process.env.APP_SECRET && !process.env.VITE_APP_SECRET) {
    errors.push("Missing APP_SECRET or VITE_APP_SECRET environment variable");
  }
  
  if (errors.length > 0) {
    console.error("❌ Configuration Errors:");
    errors.forEach(err => console.error(`  - ${err}`));
    console.error("\n⚠️  Please set these environment variables before starting.");
    process.exit(1);
  }
}

async function startServer() {
  validateConfig();
  
  console.log("Starting SmartLedger Backend Server...");
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasApiKey: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
      timestamp: new Date().toISOString()
    });
  });

  // AI Classification API Endpoint (Server-side)
  app.post("/api/classify", async (req, res) => {
    const { input, secret } = req.body;
    
    // Get configuration from environment variables ONLY
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const appSecret = process.env.APP_SECRET || process.env.VITE_APP_SECRET;

    // Input validation
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ 
        error: "INPUT_EMPTY", 
        message: "输入不能为空" 
      });
    }

    // Security: Verify the secret
    if (!secret || secret !== appSecret) {
      console.warn("Invalid secret attempt");
      return res.status(403).json({ 
        error: "INVALID_SECRET", 
        message: "验证失败" 
      });
    }

    // Check API key configuration
    if (!apiKey || apiKey.trim() === "") {
      console.error("GEMINI_API_KEY is not configured");
      return res.status(500).json({ 
        error: "API_KEY_MISSING", 
        message: "GEMINI_API_KEY 未配置" 
      });
    }

    try {
      console.log("Calling Gemini AI for classification...");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: [{ 
          parts: [{ 
            text: `你是一个专业的记账助手。请解析以下支付或收入信息，提取金额、类型（收入或支出）、分类和简短描述。
          
注意：在"描述"字段中，请优先提取消费的对象主体（例如：麦当劳、食堂、希尔顿酒店、滴滴打车、发工资等），而不是重复整个句子。

可选分类包括: ${CATEGORIES.join(", ")}。

输入信息: "${input}"

请严格按照 JSON 格式返回，包含 amount (数字), type (income 或 expense), category (字符串), description (字符串) 字段。` 
          }] 
        }],
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
      console.log("✓ Classification successful via Gemini AI");
      return res.json(result);
      
    } catch (error: any) {
      console.error("❌ Gemini API Error:", error.message);
      
      // Check for quota/API key errors
      if (error.message?.includes("API key") || error.status === 403) {
        return res.status(500).json({ 
          error: "API_KEY_INVALID", 
          message: "API Key 无效或已过期" 
        });
      }
      
      if (error.message?.includes("quota") || error.status === 429) {
        return res.status(429).json({ 
          error: "QUOTA_EXCEEDED", 
          message: "请求配额已用尽，请稍后再试" 
        });
      }

      // Fallback to local classification when AI fails
      console.warn("⚠️  Falling back to local classification");
      return res.json(getLocalClassification(input));
    }
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
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
}

// Local fallback classification when AI is unavailable
function getLocalClassification(input: string) {
  const amountMatch = input.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
  
  let type = "expense";
  if (input.includes("收") || input.includes("进账") || input.includes("发工资") || input.includes("收入") || input.includes("红")) {
    type = "income";
  }
  
  let category = "其他";
  const inputLower = input.toLowerCase();
  
  if (inputLower.match(/吃|饭|餐|奶茶|咖啡|麦当劳|肯德基|汉堡|火锅|面|食堂|饿了么|美团|早|午|晚|宵夜/)) {
    category = "餐饮美食";
  } else if (inputLower.match(/车|打的|地铁|油|公交|滴滴|打车|机票|火车|高铁|加油/)) {
    category = "交通出行";
  } else if (inputLower.match(/买|购|超市|淘宝|京东|拼多多|衣服|鞋|手机|数码|商场|便利店/)) {
    category = "购物消费";
  } else if (inputLower.match(/玩|电影|游戏|网吧|KTV|旅游|门票|酒吧|足浴|按摩/)) {
    category = "休闲娱乐";
  } else if (inputLower.match(/房租|水电|煤气|燃气|宽带|物业|话费|网费/)) {
    category = "住房缴费";
  } else if (inputLower.match(/工资|奖金|兼职|报销|分红/)) {
    category = "工资收入";
  } else if (inputLower.match(/医|药|院|体检|感冒|挂号/)) {
    category = "医疗保健";
  }
  
  let description = input;
  const subjects = ["麦当劳", "肯德基", "汉堡王", "食堂", "超市", "便利店", "滴滴", "打车", "地铁", "公交", "房租", "水电", "工资", "奖金", "希尔顿", "酒店", "淘宝", "京东", "美团", "饿了么"];
  for (const s of subjects) {
    if (input.includes(s)) {
      description = s;
      break;
    }
  }
  
  if (description === input) {
    description = input.replace(/花了|收了|收入|支出|了|元|块/g, "").trim();
  }
  
  return {
    amount,
    type,
    category,
    description: description.length > 20 ? description.substring(0, 20) : description,
    _isFallback: true,
    _isSmartFallback: category !== "其他"
  };
}

startServer();
