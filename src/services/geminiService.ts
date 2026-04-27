import { GoogleGenAI, Type } from "@google/genai";
import { Patient } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateClinicalPearls(patient: Patient): Promise<string[]> {
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
      - Notes: ${check.notes}
    `).join('\n')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
