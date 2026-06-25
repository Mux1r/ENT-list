import { GoogleGenAI } from "@google/genai";

export interface ExtractedPatientRow {
  bedNumber: string;
  chartNumber: string;
  name: string;
  age: number;
  gender?: string;
  admissionDate?: string;
}

export async function analyzePatientListImage(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedPatientRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — AI features disabled.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `請仔細看這張病患清單截圖，擷取所有病患資料並回傳 JSON 陣列。
每筆格式：{ "bedNumber": "床號", "chartNumber": "病歷號", "name": "姓名", "age": 年齡數字, "gender": "Male" 或 "Female", "admissionDate": "YYYY-MM-DD" }
注意：
- 姓名若有前綴 * 符號請去除
- 年齡只填數字，不含「歲」
- 性別：男 → "Male"，女 → "Female"
- 入院日期轉為 YYYY-MM-DD 格式（如 2026/06/22 → "2026-06-22"）；若無日期則省略該欄位
- 只回傳 JSON 陣列，不要任何說明文字`,
            },
            {
              inlineData: { mimeType, data: imageBase64 },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "[]";
    const result = JSON.parse(text);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error analyzing patient list image:", error);
    throw error;
  }
}
