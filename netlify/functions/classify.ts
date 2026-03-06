import { Handler } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";

const CATEGORIES = [
  "餐饮美食", "交通出行", "购物消费", "休闲娱乐", "医疗保健", 
  "生活日用", "住房缴费", "工资收入", "理财收益", "其他"
];

interface ClassifyRequest {
  input: string;
  secret: string;
}

interface ClassifyResult {
  amount: number;
  type: "income" | "expense";
  category: string;
  description: string;
  _isFallback?: boolean;
  _isSmartFallback?: boolean;
}

// CORS headers for the response
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const handler: Handler = async (event, context) => {
  // Handle preflight CORS requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "OK",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "METHOD_NOT_ALLOWED" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}") as ClassifyRequest;
    const { input, secret } = body;

    // Validate input
    if (!input || typeof input !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "INPUT_EMPTY",
          message: "输入不能为空",
        }),
      };
    }

    // Validate secret
    const appSecret = process.env.APP_SECRET || process.env.VITE_APP_SECRET;
    if (!appSecret) {
      console.error("APP_SECRET is not configured");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "CONFIG_ERROR",
          message: "服务器配置错误，请联系管理员",
        }),
      };
    }

    if (secret !== appSecret) {
      console.warn("Invalid secret attempt");
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "INVALID_SECRET",
          message: "验证失败，无权限调用此接口",
        }),
      };
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.error("GEMINI_API_KEY is not configured");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "API_KEY_MISSING",
          message: "GEMINI_API_KEY 未配置，请检查环境变量",
        }),
      };
    }

    // Try Gemini AI classification
    try {
      console.log("Calling Gemini AI for classification...");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: [
          {
            parts: [
              {
                text: `你是一个专业的记账助手。请解析以下支付或收入信息，提取金额、类型（收入或支出）、分类和简短描述。
          
注意：在"描述"字段中，请优先提取消费的对象主体（例如：麦当劳、食堂、希尔顿酒店、滴滴打车、发工资等），而不是重复整个句子。

可选分类包括: ${CATEGORIES.join(", ")}。

输入信息: "${input}"

请严格按照 JSON 格式返回，包含 amount (数字), type (income 或 expense), category (字符串), description (字符串) 字段。`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: "金额" },
              type: {
                type: Type.STRING,
                enum: ["income", "expense"],
                description: "类型: income 或 expense",
              },
              category: { type: Type.STRING, description: "分类" },
              description: {
                type: Type.STRING,
                description: "消费对象主体或简短描述",
              },
            },
            required: ["amount", "type", "category", "description"],
          },
        },
      });

      const result = JSON.parse(response.text || "{}");
      console.log("✓ Classification successful via Gemini AI");

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result),
      };
    } catch (error: any) {
      console.error("❌ Gemini API Error:", error.message);

      // Check for specific errors
      if (
        error.message?.includes("API key") ||
        error.status === 403 ||
        error.message?.includes("401")
      ) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "API_KEY_INVALID",
            message: "API Key 无效或已过期",
          }),
        };
      }

      if (error.message?.includes("quota") || error.status === 429) {
        return {
          statusCode: 429,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "QUOTA_EXCEEDED",
            message: "请求配额已用尽，请稍后再试",
          }),
        };
      }

      // Fallback to local classification
      console.warn(
        "⚠️  Gemini AI failed, using local fallback classification"
      );
      const fallbackResult = getLocalClassification(input);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(fallbackResult),
      };
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "INTERNAL_SERVER_ERROR",
        message: "服务器内部错误",
      }),
    };
  }
};

// Local fallback classification
function getLocalClassification(input: string): ClassifyResult {
  const amountMatch = input.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;

  let type: "income" | "expense" = "expense";
  if (
    input.includes("收") ||
    input.includes("进账") ||
    input.includes("发工资") ||
    input.includes("收入") ||
    input.includes("红")
  ) {
    type = "income";
  }

  let category = "其他";
  const inputLower = input.toLowerCase();

  if (
    inputLower.match(
      /吃|饭|餐|奶茶|咖啡|麦当劳|肯德基|汉堡|火锅|面|食堂|饿了么|美团|早|午|晚|宵夜/
    )
  ) {
    category = "餐饮美食";
  } else if (
    inputLower.match(/车|打的|地铁|油|公交|滴滴|打车|机票|火车|高铁|加油/)
  ) {
    category = "交通出行";
  } else if (
    inputLower.match(
      /买|购|超市|淘宝|京东|拼多多|衣服|鞋|手机|数码|商场|便利店/
    )
  ) {
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
  const subjects = [
    "麦当劳",
    "肯德基",
    "汉堡王",
    "食堂",
    "超市",
    "便利店",
    "滴滴",
    "打车",
    "地铁",
    "公交",
    "房租",
    "水电",
    "工资",
    "奖金",
    "希尔顿",
    "酒店",
    "淘宝",
    "京东",
    "美团",
    "饿了么",
  ];
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
    _isSmartFallback: category !== "其他",
  };
}

export { handler };
