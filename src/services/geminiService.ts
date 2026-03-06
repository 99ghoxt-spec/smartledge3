
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

export async function classifyTransaction(input: string, secret: string): Promise<ClassifiedTransaction | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch("/api/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, secret }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`HTTP_${response.status}`);
      }
      // Include the message if available for better debugging
      const errorMessage = errorData.message ? `${errorData.error}: ${errorData.message}` : errorData.error;
      throw new Error(errorMessage || `HTTP_${response.status}`);
    }

    const result = await response.json();
    return result as ClassifiedTransaction;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    console.error("Classification error:", error);
    throw error;
  }
}

export async function checkServerHealth(): Promise<any> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return { status: "error" };
    return await response.json();
  } catch (e) {
    return { status: "offline" };
  }
}
