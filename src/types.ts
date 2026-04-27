export type Gender = 'Male' | 'Female' | 'Other';

export interface ENTChecklist {
  id: string;
  date: string;
  bleeding: 'None' | 'Minor' | 'Significant';
  airway: 'Clear' | 'Stridor' | 'Obstructed';
  swallowing: 'Normal' | 'Dysphagia' | 'NPO';
  facialNerve: 'Intact' | 'Paresis' | 'Paralysis';
  hoarseness: boolean;
  drainAmount: number; // in cc
  woundStatus: 'Clean' | 'Hyperemia' | 'Discharge';
  painLevel: number; // 0-10
  fever: number; // Celsius
  notes: string;
}

export interface Patient {
  id: string;
  name: string;
  bedNumber: string;
  age: number;
  gender: Gender;
  chartNumber: string;
  admissionDate: string;
  admissionDiagnosis: string;
  preliminaryDiagnosis: string;
  treatmentPlan: string;
  status: 'Stable' | 'Critical' | 'Discharge Pending';
  clinicalPearls?: string[];
  dailyChecks: ENTChecklist[];
}
