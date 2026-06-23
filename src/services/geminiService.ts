import { GoogleGenAI, Type } from "@google/genai";
import { Patient } from "../types";

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

export async function generateClinicalPearls(patient: Patient): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — AI features disabled.");
    return ["請在 .env 設定 GEMINI_API_KEY 以啟用 AI 功能。"];
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Based on the following patient data, generate 3-5 concise clinical pearls, warnings, or nursing considerations specifically for an ENT ward setting.
    Focus on risks, monitoring points, and specific observations related to their diagnoses and recent status.

    Patient Info:
    - Age: ${patient.age}
    - Gender: ${patient.gender}
    - Admission Diagnosis: ${patient.admissionDiagnosis}
    - Preliminary Diagnosis: ${patient.preliminaryDiagnosis}
    - Treatment Plan: ${patient.treatmentPlan}

    Recent Ward Rounds (last 3 records):
    ${patient.dailyChecks.slice(0, 3).map(check => `
      - Date: ${check.date}
      - Fever: ${check.fever}°C
      - Pain: ${check.painLevel}/10
      - Bleeding: ${check.bleeding}
      - Airway: ${check.airway}
      - Swallowing: ${check.swallowing}
      - Drain: ${check.drainAmount}cc
      - Notes: ${check.notes.map(n => n.text + (n.completed ? ' (Done)' : '')).join(', ')}
    `).join('\n')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert ENT clinical consultant. Provide a list of practical, high-value clinical warnings and pearls for the nursing and resident staff. Keep them short, bulleted, and in Chinese (Traditional, Taiwan) as requested by the user, or English if you deem it more medically standard, but prioritize Traditional Chinese for general understanding.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error generating clinical pearls:", error);
    return [
      "無法生成建議，請手動評估。 (AI Generation Failed)",
      "Monitor for neck hematoma / Bleeding",
      "Assess for airway stridor"
    ];
  }
}
