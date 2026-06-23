export type Gender = 'Male' | 'Female' | 'Other';

export interface ENTChecklist {
  id: string;
  date: string;
  bleeding: 'None' | 'Minor' | 'Significant';
  airway: 'Clear' | 'Stridor' | 'Obstructed';
  swallowing: 'Normal' | 'Dysphagia' | 'NPO';
  facialNerve: 'Intact' | 'Paresis' | 'Paralysis';
  hoarseness: boolean;
  drainAmount: number;
  woundStatus: 'Clean' | 'Hyperemia' | 'Discharge';
  painLevel: number;
  fever: number;
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
  clinicalPearls?: string[];
  dailyChecks: ENTChecklist[];
  // kept optional for backward compat with existing Firestore docs
  admissionDiagnosis?: string;
  preliminaryDiagnosis?: string;
  treatmentPlan?: string;
}
