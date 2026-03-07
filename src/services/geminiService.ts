
import { GoogleGenAI, Type } from "@google/genai";

export interface ClassifiedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  _isFallback?: boolean;
  _isSmartFallback?: boolean;
}

const CATEGORIES = [
  "餐饮美食", "交通出行", "购物消费", "休闲娱乐", "医疗保健", 
  "生活日用", "住房缴费", "工资收入", "理财收益", "其他"
];

const APP_SECRET = "cxmyydsjjz";

export async function classifyTransaction(input: string, secret: string): Promise<ClassifiedTransaction | null> {
  // 1. 准备有效的 Key：优先使用用户提供的 Key，其次是环境变量
  const isUserProvidingKey = typeof secret === 'string' && secret.startsWith("AIzaSy");
  
  // 如果既不是正确的暗号，也不是有效的 API Key，则拒绝访问
  if (!isUserProvidingKey && secret !== APP_SECRET) {
    throw new Error('INVALID_SECRET');
  }

  const keys = [
    isUserProvidingKey ? secret : null,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean).map(k => k?.trim()) as string[];

  if (!input) return null;

  // 尝试使用 AI 识别
  if (keys.length > 0) {
    for (const key of keys) {
      if (key.includes("your_api_key_here") || key.includes("TODO") || key.startsWith("MY_GEMIN")) continue;

      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
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
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ["income", "expense"] },
                category: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["amount", "type", "category", "description"]
            }
          }
        });

        if (response.text) {
          const result = JSON.parse(response.text);
          return result as ClassifiedTransaction;
        }
      } catch (error: any) {
        console.warn("Gemini attempt failed:", error.message);
        // Continue to next key or fallback
      }
    }
  }

  // 2. 本地兜底逻辑 (当 AI 失败或无 Key 时)
  console.log("Using local fallback parser...");
  const amountMatch = input.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
  
  let type: 'income' | 'expense' = "expense";
  if (input.includes("收") || input.includes("进账") || input.includes("发工资") || input.includes("收入")) {
    type = "income";
  }
  
  let category = "其他";
  const inputLower = input.toLowerCase();
  if (inputLower.match(/吃|饭|餐|奶茶|咖啡|麦当劳|食堂|饿了么|美团/)) category = "餐饮美食";
  else if (inputLower.match(/车|地铁|油|公交|滴滴|打车|机票/)) category = "交通出行";
  else if (inputLower.match(/买|购|超市|淘宝|京东|拼多多/)) category = "购物消费";
  else if (inputLower.match(/玩|电影|游戏|KTV|旅游/)) category = "休闲娱乐";
  else if (inputLower.match(/房租|水电|煤气|话费/)) category = "住房缴费";
  else if (inputLower.match(/工资|奖金|兼职/)) category = "工资收入";
  
  let description = input.replace(/花了|收了|收入|支出|了|元|块/g, "").trim();
  if (description.length > 20) description = description.substring(0, 20);

  return {
    amount,
    type,
    category,
    description,
    _isFallback: true,
    _isSmartFallback: category !== "其他"
  };
}

export async function checkServerHealth(): Promise<any> {
  // Since we are moving to client-side, we can just return a mock success
  return { status: "ok", hasApiKey: !!process.env.GEMINI_API_KEY };
}
