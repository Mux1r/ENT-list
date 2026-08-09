export type Gender = 'Male' | 'Female' | 'Other';

// 病患列表與病患詳情共用的色票：床號底色＝狀態，姓名文字色＝性別
export const STATUS_TONE: Record<string, { label: string; dot: string; chip: string }> = {
  // 框線用飽和色 + 半透明：色相夠鮮，明度還是淡的
  Stable: { label: 'Stable', dot: 'bg-sage-400', chip: 'bg-sage-50 text-sage-700 border-sage-500/45' },
  Critical: { label: 'Critical', dot: 'bg-terracotta-500', chip: 'bg-terracotta-50 text-terracotta-700 border-terracotta-500/45' },
  'Discharge Pending': { label: 'Discharge Pending', dot: 'bg-clinical-500', chip: 'bg-clinical-50 text-clinical-700 border-clinical-500/45' },
  Discharged: { label: 'Discharged', dot: 'bg-natural-300', chip: 'bg-natural-100 text-natural-500 border-natural-400/40' },
};

export const GENDER_TEXT: Record<string, string> = {
  Male: 'text-clinical-700',
  Female: 'text-blush-600',
  Other: 'text-natural-500',
};

// 各評估項目一律選填：「鍵不存在」＝未評估，與「評估了，正常」是不同的事。
// 舊資料的必填值仍可直接讀取，不需 migration。
export interface ENTChecklist {
  id: string;
  date: string;
  bleeding?: 'None' | 'Minor' | 'Significant';
  airway?: 'Clear' | 'Stridor' | 'Obstructed';
  swallowing?: 'Normal' | 'Dysphagia' | 'NPO';
  facialNerve?: 'Intact' | 'Paresis' | 'Paralysis';
  hoarseness?: boolean;
  drainAmount?: number;
  woundStatus?: 'Clean' | 'Hyperemia' | 'Discharge';
  painLevel?: number;
  fever?: number;
  flap?: 'Viable' | 'Congested' | 'Ischemic' | 'Failed';
  tracheostomy?: 'In situ' | 'Capped' | 'Decannulated';
  calcium?: number;
  // ponytail: 單一總量。雙側/多條 drain 分別記錄的話改成 drains[]，目前先寫進 notes
  notes: { text: string; completed: boolean }[];
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route?: string;
  startDate: string;
  endDate?: string;
  stopReason?: string;
}

export interface LabTest {
  id: string;
  name: string;
  orderedDate: string;
  resultDate?: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  abnormalDir?: 'H' | 'L';
  status: 'pending' | 'resulted';
  category?: string;
}

export interface Examination {
  id: string;
  name: string;
  orderedDate: string;
  status: 'pending' | 'resulted';
  finding?: string;
}

export interface Patient {
  id: string;
  name: string;
  bedNumber: string;
  age: number;
  gender: Gender;
  chartNumber: string;
  admissionDate: string;
  diagnosis: string;
  status: 'Stable' | 'Critical' | 'Discharge Pending' | 'Discharged';
  medications: Medication[];
  labTests: LabTest[];
  examinations: Examination[];
dailyChecks: ENTChecklist[];
  briefing?: string;   // 交班報告原文 (markdown)
  // ponytail: 單場刀。一人多場/多天要排的話再改成 operations[]
  opDate?: string;       // YYYY-MM-DD
  opProcedure?: string;  // 術式
  dischargeDate?: string; // YYYY-MM-DD 預計出院日，沒定就留空
  // kept optional for backward compat with existing Firestore docs
  admissionDiagnosis?: string;
  preliminaryDiagnosis?: string;
  treatmentPlan?: string;
}
