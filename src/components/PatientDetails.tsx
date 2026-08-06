import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Activity,
  ClipboardList,
  FileText,
  Plus,
  Clock,
  Thermometer,
  CloudLightning,
  Droplets,
  Wind,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Check as CheckIcon,
  Pill,
  FlaskConical,
  Scan,
  Scissors,
  AlertTriangle,
  Ban,
  Edit3,
  MoreVertical,
  Volume2
} from 'lucide-react';
import { Medication, LabTest, Examination } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, ENTChecklist } from '../types';
import DailyChecklistForm from './DailyChecklistForm';
import Markdown from './Markdown';
import { format, differenceInCalendarDays, startOfWeek, addDays } from 'date-fns';

const JSON_IMPORT_PROMPT = `你是一個醫療資料結構化助手。病患的基本資料（姓名、床號、病歷號、年齡、性別、入院日期）已建立，請根據我提供的病患臨床資訊，產出下列 JSON。

## 欄位定義（不要輸出 id；沒有值的選填欄位「直接不要輸出該鍵」，不要寫空字串或「省略」）

medications[] 每筆＝一個藥物：
- name 藥名、dose 劑量(如 500mg)、frequency 頻率(如 BID/QID/Q8H/PRN)、startDate YYYY-MM-DD
- 選填：route 途徑(PO/IV)、endDate、stopReason

labTests[] 每筆＝一個檢驗值（例：WBC、Crea、Na 各一筆）：
- name 項目、orderedDate YYYY-MM-DD
- 不用輸出 status：系統依有無 value 自動判定（已開單但結果未出，就不要給 value）
- 選填：value 數值、unit 單位、referenceRange、category(CBC/DC、生化、凝血、電解質、尿液、培養、其他)
- 只有異常才加：isAbnormal:true、abnormalDir "H" 或 "L"

examinations[] 每筆＝一項影像/檢查(如 CXR、CT Neck)：
- name、orderedDate、status；選填 finding 報告內容

dailyChecks[] 每筆＝某一天的查房評估（一天一筆，date 用該次查房日期）：
- date YYYY-MM-DDTHH:mm:ssZ（必填）
- **以下全部選填，且「病歷沒明確評估到的項目，直接不要輸出該鍵」**——
  未評估不等於正常，不可用正常值填補：
  bleeding(None/Minor/Significant)、airway(Clear/Stridor/Obstructed)、
  swallowing(Normal/Dysphagia/NPO)、facialNerve(Intact/Paresis/Paralysis)、
  hoarseness(true/false)、drainAmount(數字cc)、woundStatus(Clean/Hyperemia/Discharge)、
  painLevel(0-10)、fever(攝氏數字)、flap(Viable/Congested/Ischemic/Failed)、
  tracheostomy(In situ/Capped/Decannulated)、calcium(數字 mg/dL)
- 例：parotidectomy 病人若病歷只提到 wound 與 pain，就只輸出 woundStatus 與 painLevel，
  不要附上 airway/swallowing/facialNerve
- 選填 notes: [{ "text": "備註", "completed": false }]（未記載但值得提醒的事寫這裡）

頂層另有：
- diagnosis：優先「原文照抄」progress note 的 problem list（或 A/Assessment 段的診斷列），
  不改寫、不重組語序。無 problem list 時才取術後診斷或入院診斷，格式
  「{側別} {部位} {診斷} s/p {術式}」。病理回報後以病理診斷取代臨床推測診斷。
  同一病人每日用字須一致——除非診斷實質改變，否則不要換句話說。
- status："Stable" / "Critical" / "Discharge Pending"

## 規則

- 不要輸出 id 欄位（系統會自動產生）
- 沒有資料的選填欄位整個省略，不要輸出空字串；沒有資料的陣列輸出 []
- 只輸出純 JSON，不要 \`\`\`json 標記，直接從 { 開始到 } 結束

## 病患資料

（在此貼上病患臨床資訊，例如藥囑、生命徵象、檢驗報告、影像報告）`;

// 交班報告與匯入 JSON 的分隔標記，與 data-to-list/ENT_ward_round_briefing_prompt.md 一致
const BRIEFING_SENTINEL = '===IMPORT-JSON===';

// 院內 AI 常在報告前面加上安全聲明或「以下為查房報告：」之類的開場白。
// 報告一律從【病患摘要】起算，之前的東西全部丟掉。
const stripPreamble = (md: string) => {
  const i = md.search(/(^|\n)\s*#*\s*病患摘要/);
  return i > 0 ? md.slice(i).trimStart() : md;
};

// 查房評估項目。全部選填 —— 值為 undefined 代表「未評估」，不渲染該格。
type CheckFieldDef = {
  key: keyof ENTChecklist;
  label: string;
  icon: React.ReactNode;
  options?: string[];        // 有 options = 下拉；否則為數值
  normal?: string;           // 下拉之正常值，其餘標紅
  unit?: string;
  step?: number;
  abnormal?: (v: number) => boolean;
  add: string | number | boolean;   // 從「未評估」新增時的起始值
};

const ICON_CLASS = 'w-3.5 h-3.5 text-natural-400';

const CHECK_FIELDS: CheckFieldDef[] = [
  { key: 'bleeding',     label: 'Bleeding', icon: <Droplets className={ICON_CLASS} />,        options: ['None', 'Minor', 'Significant'],          normal: 'None',    add: 'None' },
  { key: 'airway',       label: 'Airway',   icon: <Wind className={ICON_CLASS} />,            options: ['Clear', 'Stridor', 'Obstructed'],        normal: 'Clear',   add: 'Clear' },
  { key: 'fever',        label: 'Temp',     icon: <Thermometer className={ICON_CLASS} />,     unit: '°C',     step: 0.1, abnormal: v => v > 38,   add: 36.5 },
  { key: 'drainAmount',  label: 'Drain',    icon: <Droplets className={ICON_CLASS} />,        unit: 'cc',                                          add: 0 },
  { key: 'swallowing',   label: 'Swallow',  icon: <Activity className={ICON_CLASS} />,        options: ['Normal', 'Dysphagia', 'NPO'],            normal: 'Normal',  add: 'Normal' },
  { key: 'facialNerve',  label: 'CN VII',   icon: <User className={ICON_CLASS} />,            options: ['Intact', 'Paresis', 'Paralysis'],        normal: 'Intact',  add: 'Intact' },
  { key: 'painLevel',    label: 'Pain',     icon: <CloudLightning className={ICON_CLASS} />,  unit: '/10',               abnormal: v => v > 6,    add: 0 },
  { key: 'hoarseness',   label: 'Hoarse',   icon: <Volume2 className={ICON_CLASS} />,         options: ['No', 'Yes'],                             normal: 'No',      add: false },
  { key: 'woundStatus',  label: 'Wound',    icon: <AlertTriangle className={ICON_CLASS} />,   options: ['Clean', 'Hyperemia', 'Discharge'],       normal: 'Clean',   add: 'Clean' },
  { key: 'flap',         label: 'Flap',     icon: <Scan className={ICON_CLASS} />,            options: ['Viable', 'Congested', 'Ischemic', 'Failed'], normal: 'Viable', add: 'Viable' },
  { key: 'tracheostomy', label: 'Trach',    icon: <Wind className={ICON_CLASS} />,            options: ['In situ', 'Capped', 'Decannulated'],                        add: 'In situ' },
  { key: 'calcium',      label: 'Ca',       icon: <FlaskConical className={ICON_CLASS} />,    unit: 'mg/dL', step: 0.1, abnormal: v => v < 8.5,  add: 9.0 },
];

// 分頁。briefing 只在有交班報告時出現；badge 為各分頁的提醒數字。
// label 只當 tooltip/aria 用；tab 本身只顯示 icon + 右上角數量
const TABS: { key: string; label: string; icon: React.ReactNode; count?: (p: Patient) => number; tone?: string }[] = [
  { key: 'briefing', label: '交班', icon: <FileText className="w-4 h-4" /> },
  {
    key: 'med', label: '用藥（使用中）', icon: <Pill className="w-4 h-4" />,
    count: p => (p.medications || []).filter(m => !m.endDate).length,
    tone: 'bg-natural-200 text-natural-600',
  },
  {
    key: 'lab', label: '檢驗（異常）', icon: <FlaskConical className="w-4 h-4" />,
    count: p => (p.labTests || []).filter(l => l.isAbnormal).length,
    tone: 'bg-terracotta-500 text-white',
  },
  {
    key: 'exam', label: '檢查（待結果）', icon: <Scan className="w-4 h-4" />,
    count: p => (p.examinations || []).filter(e => e.status === 'pending').length,
    tone: 'bg-amber-500 text-white',
  },
  {
    key: 'rounds', label: 'Daily Round', icon: <ClipboardList className="w-4 h-4" />,
    count: p => p.dailyChecks?.length ?? 0,
    tone: 'bg-natural-200 text-natural-600',
  },
];

const LAB_CATEGORIES = ['CBC/DC', '生化', '凝血', '電解質', '尿液', '培養', '其他'] as const;

const STATUS_OPTIONS = [
  { value: 'Stable',            label: 'Stable',            triggerClass: 'bg-sage-50 text-sage-700 border-sage-200',                dotColor: 'bg-sage-500' },
  { value: 'Critical',          label: 'Critical',          triggerClass: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200', dotColor: 'bg-terracotta-500' },
  { value: 'Discharge Pending', label: 'Discharge Pending', triggerClass: 'bg-clinical-50 text-clinical-700 border-clinical-100',     dotColor: 'bg-clinical-500' },
  { value: 'Discharged',        label: 'Discharged',        triggerClass: 'bg-natural-100 text-natural-500 border-natural-200',       dotColor: 'bg-natural-400' },
] as const;

const GENDER_OPTIONS = [
  { value: 'Male',   label: 'M', triggerClass: '', dotColor: 'bg-clinical-500' },
  { value: 'Female', label: 'F', triggerClass: '', dotColor: 'bg-blush-500' },
  { value: 'Other',  label: 'O', triggerClass: '', dotColor: 'bg-natural-400' },
] as const;

// 性別改用床號底色表示
const GENDER_TONE: Record<string, string> = {
  Male: 'bg-clinical-50 text-clinical-700 border-clinical-100',
  Female: 'bg-blush-50 text-blush-600 border-blush-100',
  Other: 'bg-natural-100 text-natural-500 border-natural-200',
};

type ConflictItem = {
  field: keyof Patient;
  label: string;
  oldValue: string;
  newValue: string;
  selected: 'old' | 'new';
};

// 比對診斷時忽略標點、空白與大小寫差異，只看實質字詞
const normalizeDx = (v: unknown) =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9一-鿿]/g, '');

const CONFLICT_FIELDS: { field: keyof Patient; label: string }[] = [
  { field: 'diagnosis', label: 'Diagnosis' },
  { field: 'status', label: 'Status' },
];

interface PatientDetailsProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete: (id: string) => void;
  /** 這兩個開關的按鈕在 App 的 topbar，state 也放在那裡 */
  editHeader: boolean;
  jsonOpen: boolean;
  onCloseJson: () => void;
}

const normalizeNotes = (notes: ENTChecklist['notes'] | string | undefined): { text: string; completed: boolean }[] => {
  if (Array.isArray(notes)) return notes;
  if (typeof notes === 'string') return [{ text: notes, completed: false }];
  return [];
};

export default function PatientDetails({ patient, onUpdate, onDelete, editHeader, jsonOpen, onCloseJson }: PatientDetailsProps) {
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [activeTab, setActiveTab] = useState('rounds');
  // 各分頁預設唯讀，按下鉛筆才露出編輯/刪除
  const [editData, setEditData] = useState(false);
  // 分頁共用的「哪一天」；檢驗/檢查是累積資料，不受它影響
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showWeek, setShowWeek] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [briefingCopied, setBriefingCopied] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [pendingMerged, setPendingMerged] = useState<Patient | null>(null);
  const [checksInfo, setChecksInfo] = useState<{ added: number; updated: number } | null>(null);

  useEffect(() => { setEditData(false); setShowWeek(false); }, [activeTab, patient.id]);

  // 日期一律取「日曆日」比對，避免 dailyChecks.date 帶時間造成差一天
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
  };
  const selectedCheck = patient.dailyChecks.find(c => dayOf(c.date) === selectedDay);

  const pickDay = (day: string) => {
    setSelectedDay(day);
    setWeekStart(startOfWeek(new Date(day), { weekStartsOn: 1 }));
    setShowWeek(false);
  };


  // 手術當天 = POD 0；明天要開 = -1。用 T00:00 解析成當地午夜，跨時區不會差一天
  const pod = patient.opDate
    ? differenceInCalendarDays(new Date(), new Date(patient.opDate + 'T00:00'))
    : null;

  const [localFields, setLocalFields] = useState({
    name: patient.name,
    bedNumber: patient.bedNumber,
    chartNumber: patient.chartNumber,
    age: patient.age.toString(),
    admissionDate: patient.admissionDate,
    diagnosis: patient.diagnosis || '',
    opDate: patient.opDate || '',
    opProcedure: patient.opProcedure || '',
  });

  React.useEffect(() => {
    setLocalFields({
      name: patient.name,
      bedNumber: patient.bedNumber,
      chartNumber: patient.chartNumber,
      age: patient.age.toString(),
      admissionDate: patient.admissionDate,
      diagnosis: patient.diagnosis || '',
      opDate: patient.opDate || '',
      opProcedure: patient.opProcedure || '',
    });
  }, [patient.id, patient.name, patient.bedNumber, patient.chartNumber, patient.age, patient.admissionDate, patient.diagnosis, patient.opDate, patient.opProcedure]);

  const handleLocalChange = (field: keyof typeof localFields, value: string) => {
    setLocalFields(prev => ({ ...prev, [field]: value }));
  };

  const syncField = (field: keyof Patient, value: any) => {
    if (patient[field] === value) return;
    onUpdate({ ...patient, [field]: value });
  };

  // 一天一筆，已有就不新增（避免覆蓋當天既有紀錄）
  const handleAddCheck = (newCheck: ENTChecklist) => {
    const day = dayOf(newCheck.date);
    if (patient.dailyChecks.some(c => dayOf(c.date) === day)) {
      window.alert('這天已有查房紀錄，請直接編輯');
      return;
    }
    onUpdate({ ...patient, dailyChecks: [...patient.dailyChecks, newCheck] });
    setShowChecklistForm(false);
    setSelectedDay(day);
  };

  const handleToggleNoteCompletion = (checkId: string, noteIndex: number) => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => {
        if (c.id !== checkId) return c;
        const notesArray = normalizeNotes(c.notes);
        const newNotes = [...notesArray];
        const currentNote = typeof newNotes[noteIndex] === 'string' 
          ? { text: newNotes[noteIndex] as unknown as string, completed: false }
          : newNotes[noteIndex];
        if (!currentNote) return c;
        newNotes[noteIndex] = { ...currentNote, completed: !currentNote.completed };
        return { ...c, notes: newNotes };
      })
    });
  };

  const handleMoveNote = (checkId: string, index: number, direction: 'up' | 'down') => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => {
        if (c.id !== checkId) return c;
        // Normalize all notes first to ensure consistent objects
        const notesArray = normalizeNotes(c.notes);
        const newNotes = notesArray.map(n => typeof n === 'string' ? { text: n, completed: false } : n);
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newNotes.length) return { ...c, notes: newNotes };
        [newNotes[index], newNotes[newIndex]] = [newNotes[newIndex], newNotes[index]];
        return { ...c, notes: newNotes };
      })
    });
  };

  const handleCheckFieldUpdate = (checkId: string, field: keyof ENTChecklist, value: any) => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => 
        c.id === checkId ? { ...c, [field]: value } : c
      )
    });
  };

  const handleUpdateNoteText = (checkId: string, index: number, text: string) => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => {
        if (c.id !== checkId) return c;
        const notesArray = normalizeNotes(c.notes);
        const newNotes = notesArray.map((n, i) => 
          i === index ? (typeof n === 'string' ? { text, completed: false } : { ...n, text }) : n
        );
        return { ...c, notes: newNotes };
      })
    });
  };

  const closeJsonModal = () => {
    onCloseJson();
    setJsonText('');
    setJsonError('');
    setConflicts([]);
    setPendingMerged(null);
    setChecksInfo(null);
  };

  const handleJsonImport = () => {
    setJsonError('');

    // 交班報告整份貼上時：分隔標記之前是 markdown 原文，之後才是 JSON。
    // 找不到標記 = 貼的是純 JSON，行為與過去完全相同。
    const raw = jsonText.trim();
    const sentinelIdx = raw.indexOf(BRIEFING_SENTINEL);
    const briefing = sentinelIdx >= 0 ? stripPreamble(raw.slice(0, sentinelIdx).trim()) : '';
    // ponytail: 容錯 LLM 常自作主張加上的 ``` 圍欄
    const jsonPart = (sentinelIdx >= 0 ? raw.slice(sentinelIdx + BRIEFING_SENTINEL.length) : raw)
      .trim().replace(/^```(?:json)?\s*|\s*```$/g, '');

    let parsed: any;
    try {
      parsed = JSON.parse(jsonPart);
    } catch {
      // 院內 AI 輸出被截斷時 JSON 會壞在尾端，但人要讀的報告仍完整 → 至少把報告存下來
      if (briefing) {
        onUpdate({ ...patient, briefing });
        setJsonError('交班報告已儲存，但 JSON 解析失敗（可能被截斷），結構化資料未匯入。');
      } else {
        setJsonError('JSON 格式有誤，請確認內容完整（無多餘的 ```json 標記）。');
      }
      return;
    }

    const allowed = [
      'name', 'bedNumber', 'chartNumber', 'age', 'gender', 'admissionDate',
      'diagnosis', 'status', 'opDate', 'opProcedure',
      'medications', 'labTests', 'examinations', 'dailyChecks',
    ] as const;

    const merged: Patient = { ...patient };
    let added = 0;
    let updated = 0;

    for (const key of allowed) {
      if (!(key in parsed) || parsed[key] === undefined) continue;
      if (key === 'dailyChecks' && Array.isArray(parsed.dailyChecks)) {
        // AI 不輸出 id，故以「日曆日」比對：同一天已有紀錄就覆寫，不再無限新增。
        const dayOf = (d: string) => (d || '').slice(0, 10);
        const existingMap = new Map(patient.dailyChecks.map(c => [c.id, c]));
        for (const c of parsed.dailyChecks) {
          const prev = (c.id && existingMap.get(c.id))
            || patient.dailyChecks.find(x => dayOf(x.date) === dayOf(c.date));
          if (prev) {
            updated++;
            // 覆寫該日全部評估欄位（未評估的項目就該消失），但匯入沒帶 notes 時保留原本手寫的
            existingMap.set(prev.id, { ...c, id: prev.id, notes: c.notes ?? prev.notes });
          } else {
            added++;
            const id = crypto.randomUUID();
            existingMap.set(id, { ...c, id });
          }
        }
        merged.dailyChecks = Array.from(existingMap.values());
      } else if ((key === 'medications' || key === 'labTests' || key === 'examinations') && Array.isArray(parsed[key])) {
        (merged as any)[key] = parsed[key].map((item: any) => ({
          ...item,
          id: item.id || crypto.randomUUID(),
          // labTests 的 status 不強求 AI 輸出，依有無 value 自動判定（與 saveLab 同一條規則）
          ...(key === 'labTests' && !item.status
            ? { status: String(item.value ?? '').trim() ? 'resulted' : 'pending' }
            : {}),
        }));
      } else {
        (merged as any)[key] = parsed[key];
      }
    }

    // 每次查房本就該覆蓋昨天的報告，故不納入 CONFLICT_FIELDS
    if (briefing) merged.briefing = briefing;

    // 用字漂移（標點、空白、大小寫）不算變化。診斷已錨定 progress note 的 problem list，
    // 正規化後仍不同 = problem list 真的改了，才值得攔下來問。
    for (const { field } of CONFLICT_FIELDS) {
      const incoming = parsed[field];
      const current = patient[field];
      if (incoming !== undefined && current && normalizeDx(current) === normalizeDx(incoming)) {
        (merged as any)[field] = current;   // 保留原本字串，避免每天被改寫
      }
    }

    const found: ConflictItem[] = CONFLICT_FIELDS
      .filter(({ field }) =>
        parsed[field] !== undefined &&
        patient[field] &&
        normalizeDx(patient[field]) !== normalizeDx(parsed[field])
      )
      .map(({ field, label }) => ({
        field, label,
        oldValue: String(patient[field]),
        newValue: String(parsed[field]),
        selected: 'new' as const,
      }));

    if (found.length === 0) {
      applyMerged(merged);
    } else {
      setConflicts(found);
      setPendingMerged(merged);
      setChecksInfo(added + updated > 0 ? { added, updated } : null);
    }
  };

  const applyMerged = (merged: Patient) => {
    onUpdate(merged);
    setLocalFields({
      name: merged.name,
      bedNumber: merged.bedNumber,
      chartNumber: merged.chartNumber,
      age: merged.age.toString(),
      admissionDate: merged.admissionDate,
      diagnosis: merged.diagnosis || '',
      opDate: merged.opDate || '',
      opProcedure: merged.opProcedure || '',
    });
    closeJsonModal();
  };

  const handleApplyResolution = () => {
    if (!pendingMerged) return;
    const resolved = { ...pendingMerged };
    for (const c of conflicts) {
      if (c.selected === 'old') (resolved as any)[c.field] = patient[c.field];
    }
    applyMerged(resolved);
  };

  // 新增資料一律預設在「目前選到的那天」
  const today = selectedDay;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // Medications
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medForm, setMedForm] = useState({ name: '', dose: '', frequency: '', route: '', startDate: today });
  const [stoppingMedId, setStoppingMedId] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState('');
  const [showStoppedMeds, setShowStoppedMeds] = useState(false);

  const openAddMed = () => {
    setEditingMedId(null);
    setMedForm({ name: '', dose: '', frequency: '', route: '', startDate: today });
    setShowMedModal(true);
  };
  const openEditMed = (med: Medication) => {
    setEditingMedId(med.id);
    setMedForm({ name: med.name, dose: med.dose, frequency: med.frequency, route: med.route || '', startDate: med.startDate });
    setShowMedModal(true);
  };
  const saveMed = () => {
    if (!medForm.name.trim()) return;
    const meds = [...(patient.medications || [])];
    if (editingMedId) {
      const idx = meds.findIndex(m => m.id === editingMedId);
      if (idx >= 0) meds[idx] = { ...meds[idx], ...medForm };
    } else {
      meds.push({ id: uid(), ...medForm });
    }
    onUpdate({ ...patient, medications: meds });
    setShowMedModal(false);
  };
  const stopMed = () => {
    if (!stoppingMedId) return;
    const meds = (patient.medications || []).map(m =>
      m.id === stoppingMedId
        ? { ...m, endDate: today, stopReason: stopReason || undefined }
        : m
    );
    onUpdate({ ...patient, medications: meds });
    setStoppingMedId(null);
    setStopReason('');
  };
  // 某一天在用的藥＝已開始且尚未停用。用藥本身就是區間資料，不需要每天複製一份
  const medsOnDay = (day: string) =>
    (patient.medications || []).filter(m => (!m.startDate || m.startDate <= day) && (!m.endDate || m.endDate >= day));

  const deleteMed = (id: string, name: string) => {
    if (!window.confirm(`刪除用藥「${name}」？`)) return;
    onUpdate({ ...patient, medications: (patient.medications || []).filter(m => m.id !== id) });
  };

  // Lab tests
  const [showLabModal, setShowLabModal] = useState(false);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const emptyLabForm = { name: '', orderedDate: today, value: '', unit: '', referenceRange: '', isAbnormal: false, abnormalDir: '' as '' | 'H' | 'L', resultDate: '', category: 'CBC/DC' };
  const [labForm, setLabForm] = useState(emptyLabForm);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const openAddLab = () => { setEditingLabId(null); setLabForm(emptyLabForm); setShowLabModal(true); };
  const openEditLab = (lab: LabTest) => {
    setEditingLabId(lab.id);
    setLabForm({ name: lab.name, orderedDate: lab.orderedDate, value: lab.value || '', unit: lab.unit || '', referenceRange: lab.referenceRange || '', isAbnormal: lab.isAbnormal || false, abnormalDir: lab.abnormalDir || '', resultDate: lab.resultDate || '', category: lab.category || '其他' });
    setShowLabModal(true);
  };
  const saveLab = () => {
    if (!labForm.name.trim()) return;
    const status: LabTest['status'] = labForm.value.trim() ? 'resulted' : 'pending';
    const labs = [...(patient.labTests || [])];
    if (editingLabId) {
      const idx = labs.findIndex(l => l.id === editingLabId);
      if (idx >= 0) labs[idx] = { ...labs[idx], ...labForm, status };
    } else {
      labs.push({ id: uid(), ...labForm, status });
    }
    onUpdate({ ...patient, labTests: labs });
    setShowLabModal(false);
  };
  const deleteLab = (id: string, name: string) => {
    if (!window.confirm(`刪除檢驗「${name}」？`)) return;
    onUpdate({ ...patient, labTests: (patient.labTests || []).filter(l => l.id !== id) });
  };

  // Examinations
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const emptyExamForm = { name: '', orderedDate: today, status: 'pending' as Examination['status'], finding: '' };
  const [examForm, setExamForm] = useState(emptyExamForm);

  const openAddExam = () => { setEditingExamId(null); setExamForm(emptyExamForm); setShowExamModal(true); };
  const openEditExam = (exam: Examination) => {
    setEditingExamId(exam.id);
    setExamForm({ name: exam.name, orderedDate: exam.orderedDate, status: exam.status, finding: exam.finding || '' });
    setShowExamModal(true);
  };
  const saveExam = () => {
    if (!examForm.name.trim()) return;
    const exams = [...(patient.examinations || [])];
    if (editingExamId) {
      const idx = exams.findIndex(e => e.id === editingExamId);
      if (idx >= 0) exams[idx] = { ...exams[idx], ...examForm };
    } else {
      exams.push({ id: uid(), ...examForm });
    }
    onUpdate({ ...patient, examinations: exams });
    setShowExamModal(false);
  };
  const deleteExam = (id: string, name: string) => {
    if (!window.confirm(`刪除檢查「${name}」？`)) return;
    onUpdate({ ...patient, examinations: (patient.examinations || []).filter(e => e.id !== id) });
  };
  // ───────────────────────────────────────────────────────────────

  // 各分頁第一列：新增（圖示）· 日期 · 編輯開關。dayCount 為週曆上每一天的筆數，不給就不顯示數字
  const tabBar = (onAdd: () => void, dayCount?: (day: string) => number) => {
    const week = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
    return (
      <>
        <div className="flex items-center px-2 py-2">
          <button onClick={onAdd} title="新增" className="p-2 rounded-lg text-sage-600 hover:bg-sage-50 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowWeek(v => !v)}
            className={`flex-1 mx-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
              showWeek ? 'bg-natural-100 text-natural-700' : 'text-natural-500 hover:bg-natural-50'
            }`}
          >
            {selectedDay === todayStr ? 'Today' : format(new Date(selectedDay), 'MM/dd (EEE)')}
          </button>
          <button
            onClick={() => setEditData(v => !v)}
            title={editData ? '完成編輯' : '編輯'}
            className={`p-2 rounded-lg transition-colors ${editData ? 'bg-sage-500 text-white' : 'text-natural-300 hover:text-sage-600 hover:bg-sage-50'}`}
          >
            {editData ? <CheckIcon className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </button>
        </div>

        {showWeek && (
          <div className="border-t border-natural-100 bg-natural-50/60">
            <div className="flex items-center justify-between px-2 sm:px-4 pt-2 sm:pt-3">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded-lg text-natural-300 hover:text-sage-600 hover:bg-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => pickDay(todayStr)}
                className="text-[10px] font-bold uppercase tracking-widest text-natural-400 hover:text-sage-600 transition-colors"
              >
                {format(weekStart, 'MM/dd')} – {format(addDays(weekStart, 6), 'MM/dd')} · 今天
              </button>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded-lg text-natural-300 hover:text-sage-600 hover:bg-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between gap-0.5 sm:gap-1 px-2 sm:px-4 pt-2 pb-4">
              {week.map(day => {
                const isPicked = day === selectedDay;
                const n = dayCount?.(day);
                return (
                  <button key={day} onClick={() => pickDay(day)} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isPicked ? 'text-sage-600' : 'text-natural-300'}`}>
                      {format(new Date(day), 'EEE')}
                    </span>
                    <span
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                        isPicked
                          ? 'bg-sage-500 border-sage-500 text-white shadow-sm'
                          : `bg-white text-natural-500 group-hover:border-sage-300 ${day === todayStr ? 'border-sage-300' : 'border-natural-200'}`
                      }`}
                    >
                      {format(new Date(day), 'd')}
                    </span>
                    {n !== undefined && (
                      <span className={`text-[10px] font-bold ${n === 0 ? 'text-natural-200' : isPicked ? 'text-sage-600' : 'text-clay-500'}`}>
                        {n === 0 ? '—' : n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4 text-natural-600">
      {/* Patient Header Card */}
      <div className="bg-white rounded-2xl px-3 sm:px-5 py-3 sm:py-4 border border-natural-200 shadow-sm space-y-2">
        {/* Row 1: bed · name · age · gender · status dot · actions */}
        <div className="flex items-start gap-1">
          {/* 欄位自己換行，右側動作永遠留在第一行 */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap flex-1 min-w-0">
          <input
            value={localFields.bedNumber}
            disabled={!editHeader}
            onChange={(e) => handleLocalChange('bedNumber', e.target.value)}
            onBlur={() => syncField('bedNumber', localFields.bedNumber)}
            className={`px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wider focus:ring-1 focus:ring-sage-500 focus:outline-hidden [field-sizing:content] min-w-[32px] ${GENDER_TONE[patient.gender] ?? GENDER_TONE.Other}`}
          />
          <input
            value={localFields.name}
            disabled={!editHeader}
            onChange={(e) => handleLocalChange('name', e.target.value)}
            onBlur={() => syncField('name', localFields.name)}
            placeholder="病患姓名"
            className={`text-lg text-natural-900 bg-transparent border-b focus:border-sage-500 focus:outline-hidden [field-sizing:content] min-w-[80px] ${editHeader ? 'border-natural-200' : 'border-transparent'}`}
          />
          <span className="flex items-baseline gap-0.5">
            <input
              type="number"
              value={localFields.age}
              disabled={!editHeader}
              onChange={(e) => handleLocalChange('age', e.target.value)}
              onBlur={() => syncField('age', parseInt(localFields.age) || 0)}
              className={`[field-sizing:content] min-w-[20px] text-sm font-bold text-natural-500 bg-transparent border-b focus:border-sage-500 focus:outline-hidden text-right appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${editHeader ? 'border-natural-200' : 'border-transparent'}`}
            />
            {editHeader ? (
              <DropdownSelect
                value={patient.gender}
                onChange={(v) => syncField('gender', v)}
                options={GENDER_OPTIONS as unknown as { value: string; label: string; triggerClass: string; dotColor: string }[]}
                bare
              />
            ) : (
              <span className="text-sm font-bold text-natural-500">
                {GENDER_OPTIONS.find(o => o.value === patient.gender)?.label ?? 'O'}
              </span>
            )}
          </span>
          <span className="w-1.5" />
          <DropdownSelect
            value={patient.status}
            onChange={(v) => syncField('status', v)}
            options={STATUS_OPTIONS as unknown as { value: string; label: string; triggerClass: string; dotColor: string }[]}
            compact
          />
          </div>
          {pod !== null && (
            <span
              className="shrink-0 self-start px-2 py-0.5 rounded-full border border-clay-400 text-clay-600 text-[10px] font-bold uppercase tracking-wider"
              title={`手術日 ${patient.opDate}${patient.opProcedure ? `：${patient.opProcedure}` : ''}`}
            >
              POD {pod}
            </span>
          )}
        </div>

        {/* Row 2: diagnosis */}
        <textarea
          value={localFields.diagnosis}
          onChange={(e) => handleLocalChange('diagnosis', e.target.value)}
          onBlur={() => syncField('diagnosis', localFields.diagnosis)}
          rows={2}
          placeholder="入院診斷…"
          className="w-full text-sm font-bold text-natural-700 bg-transparent resize-none focus:outline-hidden leading-relaxed placeholder-natural-200"
        />

        {/* Row 3: 病歷號 / 入院日，只在編輯時單獨一行 */}
        {editHeader && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-natural-400">
            <input
              value={localFields.chartNumber}
              onChange={(e) => handleLocalChange('chartNumber', e.target.value)}
              onBlur={() => syncField('chartNumber', localFields.chartNumber)}
              className="font-mono font-bold text-natural-400 bg-transparent border-b border-natural-200 focus:border-sage-500 focus:outline-hidden [field-sizing:content] min-w-[56px]"
            />
            <span className="text-natural-200">·</span>
            <input
              type="date"
              value={localFields.admissionDate}
              onChange={(e) => handleLocalChange('admissionDate', e.target.value)}
              onBlur={() => syncField('admissionDate', localFields.admissionDate)}
              className="font-bold text-natural-400 bg-transparent border-b border-natural-200 focus:border-sage-500 focus:outline-hidden w-auto"
            />
          </div>
        )}

        {/* Row 4: OP */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-natural-400">
          <Scissors className="w-3.5 h-3.5 text-clay-600 shrink-0" />
          <span className="sr-only">OP</span>
          <input
            type="date"
            value={localFields.opDate}
            onChange={(e) => handleLocalChange('opDate', e.target.value)}
            onBlur={() => syncField('opDate', localFields.opDate)}
            className="font-bold text-natural-400 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden w-auto"
          />
          <input
            value={localFields.opProcedure}
            onChange={(e) => handleLocalChange('opProcedure', e.target.value)}
            onBlur={() => syncField('opProcedure', localFields.opProcedure)}
            placeholder="術式…"
            className="flex-1 min-w-[120px] text-natural-400 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden placeholder-natural-200"
          />
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="space-y-3">

        <div className="flex border-b border-natural-200">
          {TABS.filter(t => t.key !== 'briefing' || patient.briefing).map(t => {
            const n = t.count?.(patient) ?? 0;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                title={t.label}
                aria-label={t.label}
                className={`relative flex-1 flex items-center justify-center py-3 border-b-2 -mb-px transition-colors ${
                  activeTab === t.key
                    ? 'border-sage-500 text-sage-600'
                    : 'border-transparent text-natural-300 hover:text-natural-600'
                }`}
              >
                {t.icon}
                {n > 0 && (
                  <span className={`absolute top-1.5 right-1/2 -mr-4 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${t.tone}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── 交班報告 ── */}
        {activeTab === 'briefing' && patient.briefing && (
          <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
            <div className="flex justify-end">
              <button
                onClick={() => { navigator.clipboard.writeText(patient.briefing || ''); setBriefingCopied(true); setTimeout(() => setBriefingCopied(false), 1500); }}
                className="px-4 py-3 text-xs font-bold text-sage-600 hover:bg-sage-50 transition-colors flex items-center gap-1"
              >
                {briefingCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {briefingCopied ? '已複製' : '複製'}
              </button>
            </div>
            <div className="px-3 sm:px-5 pb-4 border-t border-natural-50 pt-3">
              <Markdown text={patient.briefing} />
            </div>
          </div>
        )}

        {/* ── 用藥 ── */}
        {activeTab === 'med' && (
          <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
            {tabBar(openAddMed, day => medsOnDay(day).length)}
            <div className="px-3 sm:px-5 pb-4 pt-3 border-t border-natural-50">
                  {(() => {
                    const meds = patient.medications || [];
                    const active = medsOnDay(selectedDay);
                    const stopped = meds.filter(m => m.endDate && m.endDate < selectedDay);
                    return (
                      <div className="space-y-3">
                        {active.length === 0 && <p className="text-xs text-natural-300 italic py-2">這天沒有用藥</p>}
                        {active.map(med => (
                          <div key={med.id} className="flex items-center gap-3 p-3 bg-natural-50 rounded-xl border border-natural-100">
                            <Pill className="w-4 h-4 text-sage-500 shrink-0" />
                            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                              <span className="text-sm font-bold text-natural-900 shrink-0">{med.name}</span>
                              <span className="text-xs text-natural-400 truncate">{med.dose} · {med.frequency}{med.route ? ` · ${med.route}` : ''}</span>
                            </div>
                            {editData && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditMed(med)} className="p-1.5 text-natural-300 hover:text-sage-500 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { setStoppingMedId(med.id); setStopReason(''); }} className="p-1.5 text-natural-300 hover:text-terracotta-500 transition-colors" title="停用"><Ban className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                        {stopped.length > 0 && (
                          <div>
                            <button onClick={() => setShowStoppedMeds(p => !p)} className="flex items-center gap-1 text-[10px] font-bold text-natural-400 uppercase tracking-widest hover:text-natural-600 transition-colors mt-2">
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStoppedMeds ? 'rotate-180' : ''}`} />
                              已停用 ({stopped.length})
                            </button>
                            {showStoppedMeds && (
                              <div className="mt-2 space-y-2">
                                {stopped.map(med => (
                                  <div key={med.id} className="flex items-center gap-3 p-3 bg-natural-50/50 rounded-xl border border-natural-100 opacity-60">
                                    <Ban className="w-4 h-4 text-natural-300 shrink-0" />
                                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                                      <span className="text-sm font-bold text-natural-400 line-through shrink-0">{med.name}</span>
                                      <span className="text-xs text-natural-300 truncate">{med.dose} · {med.frequency}{med.route ? ` · ${med.route}` : ''}{med.stopReason ? ` ｜ ${med.stopReason}` : ''}</span>
                                    </div>
                                    {editData && (
                                      <button onClick={() => deleteMed(med.id, med.name)} className="p-1.5 text-natural-200 hover:text-terracotta-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
            </div>
          </div>
        )}

        {/* ── 檢驗 ── */}
        {activeTab === 'lab' && (
          <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
            {tabBar(openAddLab, day => (patient.labTests || []).filter(l => (l.resultDate || l.orderedDate) === day).length)}
            <div className="px-3 sm:px-5 pb-4 pt-3 border-t border-natural-50">
                  {(() => {
                    const labs = patient.labTests || [];
                    const pending = labs.filter(l => l.status === 'pending');
                    const displayed = showPendingOnly ? pending : labs;
                    return (
                      <div className="space-y-3">
                        {pending.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowPendingOnly(p => !p)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${showPendingOnly ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                            >
                              <Clock className="w-3 h-3" /> 待報告 {pending.length}
                            </button>
                          </div>
                        )}
                        {displayed.length === 0 && <p className="text-xs text-natural-300 italic py-2">{showPendingOnly ? '無待報告項目' : '尚無檢驗紀錄'}</p>}
                        {displayed.length > 0 && (() => {
                          // 匯入的 category 可能不在 LAB_CATEGORIES（如 AI 給了 RFT/LFT），
                          // 未知分類一律歸入「其他」，否則會整筆從畫面上消失
                          const catOf = (l: LabTest) =>
                            LAB_CATEGORIES.includes(l.category as typeof LAB_CATEGORIES[number]) ? l.category! : '其他';
                          const grouped = LAB_CATEGORIES
                            .map(cat => {
                              const catItems = displayed.filter(l => catOf(l) === cat);
                              if (!catItems.length) return null;
                              const testNames = [...new Set(catItems.map(l => l.name))];
                              const dates = [...new Set(catItems.map(l => l.orderedDate))].sort();
                              const lookup = new Map<string, Map<string, LabTest>>();
                              for (const lab of catItems) {
                                if (!lookup.has(lab.orderedDate)) lookup.set(lab.orderedDate, new Map());
                                lookup.get(lab.orderedDate)!.set(lab.name, lab);
                              }
                              return { cat, testNames, dates, lookup };
                            })
                            .filter(Boolean) as { cat: string; testNames: string[]; dates: string[]; lookup: Map<string, Map<string, LabTest>> }[];

                          const valColor = (lab: LabTest) =>
                            lab.abnormalDir === 'H' ? 'text-terracotta-600 font-bold' :
                            lab.abnormalDir === 'L' ? 'text-clinical-600 font-bold' :
                            lab.isAbnormal ? 'text-terracotta-600 font-bold' :
                            'text-natural-800 font-medium';

                          return (
                            <div className="space-y-4">
                              {grouped.map(({ cat, testNames, dates, lookup }) => (
                                <div key={cat} className="overflow-x-auto">
                                  <table className="text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-natural-200">
                                        <td className="py-1.5 pr-6 text-[9px] font-bold text-natural-400 uppercase tracking-widest whitespace-nowrap">{cat}</td>
                                        {testNames.map(name => (
                                          <th key={name} className="text-left py-1.5 px-3 font-bold text-natural-700 min-w-[64px] whitespace-nowrap">
                                            <div className="flex items-center gap-1 group/col">
                                              <span>{name}</span>
                                              {editData && (
                                                <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/col:opacity-100 transition-opacity">
                                                  {(() => {
                                                    const anyLab = lookup.get(dates[0])?.get(name) ?? lookup.get(dates[dates.length - 1])?.get(name);
                                                    return anyLab ? (
                                                      <>
                                                        <button onClick={() => openEditLab(anyLab)} className="p-0.5 text-natural-300 hover:text-sage-500 transition-colors"><Edit3 className="w-3 h-3" /></button>
                                                        <button onClick={() => deleteLab(anyLab.id, anyLab.name)} className="p-0.5 text-natural-200 hover:text-terracotta-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                      </>
                                                    ) : null;
                                                  })()}
                                                </div>
                                              )}
                                            </div>
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dates.map((date, di) => (
                                        <tr key={date} className={di < dates.length - 1 ? 'border-b border-natural-50' : ''}>
                                          <td className="py-1.5 pr-6 text-natural-400 whitespace-nowrap">{date}</td>
                                          {testNames.map(name => {
                                            const lab = lookup.get(date)?.get(name);
                                            return (
                                              <td key={name} className="py-1.5 px-3 relative group/cell">
                                                {lab ? (
                                                  lab.status === 'pending'
                                                    ? <span className="text-natural-300 italic text-[10px]">pending</span>
                                                    : <span className={valColor(lab)}>{lab.value || '—'}</span>
                                                ) : (
                                                  <span className="text-natural-200">—</span>
                                                )}
                                                {lab && editData && (
                                                  <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover/cell:opacity-100 transition-opacity bg-white/80 px-1">
                                                    <button onClick={() => openEditLab(lab)} className="p-0.5 text-natural-300 hover:text-sage-500 transition-colors"><Edit3 className="w-3 h-3" /></button>
                                                    <button onClick={() => deleteLab(lab.id, lab.name)} className="p-0.5 text-natural-200 hover:text-terracotta-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
            </div>
          </div>
        )}

        {/* ── 檢查 ── */}
        {activeTab === 'exam' && (
          <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
            {tabBar(openAddExam, day => (patient.examinations || []).filter(e => e.orderedDate === day).length)}
            <div className="px-3 sm:px-5 pb-4 pt-3 border-t border-natural-50">
                  {(() => {
                    // 新的排前面；日期缺漏的沉底
                    const exams = [...(patient.examinations || [])]
                      .sort((a, b) => (b.orderedDate || '').localeCompare(a.orderedDate || ''));
                    return (
                      <div className="space-y-3">
                        {exams.length === 0 && <p className="text-xs text-natural-300 italic py-2">尚無檢查紀錄</p>}
                        {/* 只露日期＋名稱，報告內容點開才看 —— 用原生 details，不用自己管展開狀態 */}
                        {exams.map(exam => (
                          <details key={exam.id} className="group p-3 bg-natural-50 rounded-xl border border-natural-100">
                            <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                              <span className="text-[10px] text-natural-400 shrink-0 tabular-nums">{exam.orderedDate}</span>
                              <span className="text-sm font-bold text-natural-900 truncate">{exam.name}</span>
                              {exam.status === 'pending' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shrink-0">待報告</span>
                              )}
                              {editData && (
                                <div className="flex gap-1 shrink-0 ml-auto">
                                  <button onClick={(e) => { e.preventDefault(); openEditExam(exam); }} className="p-1.5 text-natural-300 hover:text-sage-500 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                                  <button onClick={(e) => { e.preventDefault(); deleteExam(exam.id, exam.name); }} className="p-1.5 text-natural-200 hover:text-terracotta-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                              {exam.finding && (
                                <ChevronDown className={`w-3.5 h-3.5 text-natural-300 shrink-0 transition-transform group-open:rotate-180 ${editData ? '' : 'ml-auto'}`} />
                              )}
                            </summary>
                            {exam.finding && (
                              <p className="mt-2 pt-2 border-t border-natural-100 text-xs text-natural-600 whitespace-pre-wrap">{exam.finding}</p>
                            )}
                          </details>
                        ))}
                      </div>
                    );
                  })()}
            </div>
          </div>
        )}

        {/* ── Daily Rounds ── */}
        {activeTab === 'rounds' && (
          <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
            {tabBar(() => setShowChecklistForm(true), day => patient.dailyChecks.some(c => dayOf(c.date) === day) ? 1 : 0)}
            <div className="px-3 sm:px-5 pb-5 pt-3 border-t border-natural-50 space-y-4">
                  {showChecklistForm && (
                    <DailyChecklistForm day={selectedDay} onCancel={() => setShowChecklistForm(false)} onSubmit={handleAddCheck} />
                  )}
                      <div className="relative group/carousel">
                        <AnimatePresence mode="wait">
                          {selectedCheck ? (
                            <motion.div
                              key={selectedCheck.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0 }}
                              className="bg-white rounded-3xl border border-natural-200 shadow-xl flex flex-col"
                            >
                              {(() => {
                                const check = selectedCheck;
                                if (!check) return null;
                                return (
                                  <>
                                    <div className="p-3 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 relative group/content">
                                    {editData && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm('刪除這筆查房紀錄？')) {
                                          onUpdate({ ...patient, dailyChecks: patient.dailyChecks.filter(c => c.id !== check.id) });
                                        }
                                      }}
                                      className="absolute top-4 right-4 p-2 text-natural-300 hover:text-terracotta-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover/content:opacity-100 bg-white border border-natural-100 rounded-full shadow-sm hover:shadow-md z-10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                      {CHECK_FIELDS.filter(f => check[f.key] !== undefined).map(f => {
                                        const raw = check[f.key] as string | number | boolean | undefined;
                                        const isBool = typeof f.add === 'boolean';
                                        const shown = isBool ? (raw ? 'Yes' : 'No') : raw;
                                        const bad = f.options
                                          ? (f.normal !== undefined && shown !== f.normal)
                                          : (f.abnormal ? f.abnormal(raw as number) : false);
                                        return (
                                          <div key={f.key} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-natural-100 shadow-xs group/tile">
                                            <div className="w-7 h-7 rounded-lg bg-natural-50 flex items-center justify-center shrink-0">{f.icon}</div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                              <span className="text-[9px] font-bold text-natural-400 uppercase tracking-wider leading-none mb-0.5">{f.label}</span>
                                              {f.options ? (
                                                <select
                                                  value={shown as string}
                                                  disabled={!editData}
                                                  onChange={e => handleCheckFieldUpdate(check.id, f.key, isBool ? e.target.value === 'Yes' : e.target.value)}
                                                  className={`bg-transparent text-xs font-bold focus:outline-hidden disabled:appearance-none disabled:cursor-default cursor-pointer ${bad ? 'text-terracotta-600' : 'text-natural-800'}`}
                                                >
                                                  {f.options.map(o => <option key={o}>{o}</option>)}
                                                </select>
                                              ) : (
                                                <span className="flex items-baseline gap-0.5">
                                                  <input
                                                    type="number" step={f.step} value={raw as number}
                                                    disabled={!editData}
                                                    onChange={e => handleCheckFieldUpdate(check.id, f.key, e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                    className={`w-12 bg-transparent text-xs font-bold focus:outline-hidden ${bad ? 'text-terracotta-600' : 'text-natural-800'}`}
                                                  />
                                                  <span className="text-[9px] text-natural-400">{f.unit}</span>
                                                </span>
                                              )}
                                            </div>
                                            {editData && (
                                              <button
                                                onClick={() => handleCheckFieldUpdate(check.id, f.key, undefined)}
                                                title="標為未評估"
                                                className="p-1 text-natural-200 hover:text-terracotta-500 opacity-100 sm:opacity-0 sm:group-hover/tile:opacity-100 transition-all shrink-0"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {editData && CHECK_FIELDS.some(f => check[f.key] === undefined) && (
                                        <select
                                          value=""
                                          onChange={e => { const f = CHECK_FIELDS.find(x => x.key === e.target.value); if (f) handleCheckFieldUpdate(check.id, f.key, f.add); }}
                                          className="text-[10px] font-bold text-natural-400 bg-natural-50 border border-dashed border-natural-200 rounded-xl px-2 py-2.5 cursor-pointer hover:border-sage-400 hover:text-sage-600 transition-colors focus:outline-hidden"
                                        >
                                          <option value="">＋ 評估項目</option>
                                          {CHECK_FIELDS.filter(f => check[f.key] === undefined).map(f => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>

                                    <div className="flex-1 shrink-0 pt-6 lg:pt-0 lg:pl-8 lg:border-l border-natural-100 max-w-md">
                                      {editData && (
                                        <div className="flex justify-end items-center mb-3">
                                          <button
                                            onClick={() => {
                                              const notesArray = normalizeNotes(check.notes);
                                              handleCheckFieldUpdate(check.id, 'notes', [...notesArray, { text: '', completed: false }]);
                                            }}
                                            className="p-1 text-sage-500 hover:bg-sage-50 rounded transition-all"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                      <ul className="space-y-2">
                                        {(normalizeNotes(check.notes)).map((noteRaw, idx, notes) => {
                                          const note = typeof noteRaw === 'string' ? { text: noteRaw, completed: false } : noteRaw;
                                          return (
                                            <li
                                              key={idx}
                                              className={`flex gap-2 items-start group/item transition-all ${
                                                note.completed ? 'opacity-40' : 'opacity-100'
                                              }`}
                                            >
                                              {editData && (
                                              <div className="flex flex-col gap-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity shrink-0">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleMoveNote(check.id, idx, 'up'); }}
                                                  disabled={idx === 0}
                                                  className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-10 text-natural-400 hover:text-sage-600"
                                                >
                                                  <ChevronUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleMoveNote(check.id, idx, 'down'); }}
                                                  disabled={idx === notes.length - 1}
                                                  className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-10 text-natural-400 hover:text-sage-600"
                                                >
                                                  <ChevronDown className="w-3 h-3" />
                                                </button>
                                              </div>
                                              )}

                                              <div
                                                onClick={() => handleToggleNoteCompletion(check.id, idx)}
                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all mt-1 shrink-0 cursor-pointer ${
                                                  note.completed ? 'bg-sage-400 border-sage-500' : 'bg-white border-natural-200 group-hover/item:border-sage-400'
                                                }`}
                                              >
                                                {note.completed && <X className="w-3 h-3 text-white" />}
                                              </div>

                                              <div className="flex-1 min-w-0">
                                                <input
                                                  value={note.text}
                                                  readOnly={!editData}
                                                  onChange={(e) => handleUpdateNoteText(check.id, idx, e.target.value)}
                                                  className={`w-full bg-transparent text-sm font-medium leading-tight focus:outline-hidden border-b border-transparent read-only:hover:border-transparent hover:border-natural-100 focus:border-sage-400 ${
                                                    note.completed ? 'line-through text-natural-400' : 'text-natural-900 italic'
                                                  }`}
                                                />
                                              </div>

                                              {editData && (
                                                <button
                                                  onClick={() => {
                                                    const notesArray = normalizeNotes(check.notes);
                                                    handleCheckFieldUpdate(check.id, 'notes', notesArray.filter((_, i) => i !== idx));
                                                  }}
                                                  className="opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 p-1 text-natural-300 hover:text-terracotta-500 transition-all shrink-0"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </motion.div>
                          ) : (
                            <div className="py-10 text-center border-2 border-dashed border-natural-200 rounded-2xl">
                              <ClipboardList className="w-10 h-10 text-natural-200 mx-auto mb-3" />
                              <p className="text-natural-400 font-bold uppercase tracking-widest text-xs">這天沒有查房紀錄</p>
                              <button onClick={() => setShowChecklistForm(true)} className="mt-3 text-xs font-bold text-sage-600 hover:underline">新增這天的紀錄</button>
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
            </div>
          </div>
        )}

      </div>

      {/* JSON Import Modal */}
      {jsonOpen && (
        <div className="fixed inset-0 bg-natural-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-natural-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-natural-100">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-sage-500" />
                <h3 className="font-serif font-bold text-natural-900">
                  {conflicts.length > 0 ? '資料衝突，請選擇版本' : '貼上 JSON 更新病患資料'}
                </h3>
              </div>
              <button onClick={closeJsonModal} className="text-natural-300 hover:text-natural-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* ── Conflict diff view ── */}
              {conflicts.length > 0 ? (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    偵測到 <strong>{conflicts.length}</strong> 處資料衝突。預設使用新資料，可逐欄調整。
                  </p>

                  <div className="divide-y divide-natural-100 border border-natural-200 rounded-xl overflow-hidden">
                    {conflicts.map((c, i) => (
                      <div key={c.field} className="p-4 space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-natural-400">{c.label}</span>
                          <div className="flex rounded-lg overflow-hidden border border-natural-200 text-[10px] font-bold">
                            <button
                              onClick={() => setConflicts(prev => prev.map((x, j) => j === i ? { ...x, selected: 'old' } : x))}
                              className={`px-3 py-1 transition-all ${c.selected === 'old' ? 'bg-natural-700 text-white' : 'text-natural-400 hover:bg-natural-50'}`}
                            >
                              保留現有
                            </button>
                            <button
                              onClick={() => setConflicts(prev => prev.map((x, j) => j === i ? { ...x, selected: 'new' } : x))}
                              className={`px-3 py-1 transition-all ${c.selected === 'new' ? 'bg-sage-500 text-white' : 'text-natural-400 hover:bg-natural-50'}`}
                            >
                              使用新資料
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`p-2 rounded-lg text-[10px] font-mono leading-relaxed border ${c.selected === 'old' ? 'border-natural-400 bg-natural-50' : 'border-natural-100 bg-natural-50 opacity-50'}`}>
                            <span className="text-[9px] font-bold uppercase text-natural-400 block mb-1">現有</span>
                            {c.oldValue.length > 120 ? c.oldValue.slice(0, 120) + '…' : c.oldValue}
                          </div>
                          <div className={`p-2 rounded-lg text-[10px] font-mono leading-relaxed border ${c.selected === 'new' ? 'border-sage-400 bg-sage-50' : 'border-natural-100 bg-natural-50 opacity-50'}`}>
                            <span className="text-[9px] font-bold uppercase text-sage-500 block mb-1">新資料</span>
                            {c.newValue.length > 120 ? c.newValue.slice(0, 120) + '…' : c.newValue}
                          </div>
                        </div>
                      </div>
                    ))}

                    {checksInfo && (
                      <div className="px-4 py-3 bg-natural-50 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-natural-400">Daily Checks</span>
                        <span className="text-xs text-natural-500">
                          新增 <strong>{checksInfo.added}</strong> 筆，更新 <strong>{checksInfo.updated}</strong> 筆（自動合併）
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={() => setConflicts([])}
                      className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-natural-400 hover:text-natural-600 transition-colors"
                    >
                      ← 返回編輯
                    </button>
                    <button
                      onClick={handleApplyResolution}
                      className="flex items-center gap-2 bg-sage-500 hover:bg-sage-600 text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                      確認更新
                    </button>
                  </div>
                </>
              ) : (
                /* ── Normal paste view ── */
                <>
                  <div className="flex items-center justify-between bg-natural-50 border border-natural-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-natural-500 leading-relaxed">
                      查房交班報告可<strong>整份貼上</strong>（含 {BRIEFING_SENTINEL} 之前的 Markdown）；<br/>
                      也可只貼純 JSON —— 先複製右側 Prompt 給院內 AI，再貼回傳結果。<br/>
                      <span className="text-natural-400">基本資料（姓名、床號等）已由截圖匯入，此處只需臨床內容。</span>
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON_IMPORT_PROMPT);
                        setPromptCopied(true);
                        setTimeout(() => setPromptCopied(false), 2000);
                      }}
                      className="ml-4 shrink-0 flex items-center gap-1.5 bg-white border border-natural-200 text-natural-600 hover:border-sage-400 hover:text-sage-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    >
                      {promptCopied ? <CheckIcon className="w-3.5 h-3.5 text-sage-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {promptCopied ? '已複製' : '複製 Prompt'}
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={jsonText}
                    onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
                    placeholder={'{\n  "diagnosis": "...",\n  "status": "Stable",\n  "medications": [],\n  "labTests": [],\n  "examinations": [],\n  "dailyChecks": [...]\n}'}
                    className="w-full px-4 py-3 bg-natural-50 border border-natural-200 rounded-xl text-xs font-mono text-natural-800 placeholder-natural-300 focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden resize-none"
                  />
                  {jsonError && (
                    <p className="text-xs text-terracotta-600 bg-terracotta-50 border border-terracotta-100 rounded-lg px-3 py-2">{jsonError}</p>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={closeJsonModal}
                      className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-natural-400 hover:text-natural-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleJsonImport}
                      disabled={!jsonText.trim()}
                      className="flex items-center gap-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      解析並更新
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Stop Medication Confirm ── */}
      {stoppingMedId && (
        <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-6 border border-natural-200">
            <h3 className="text-base font-bold text-natural-900 mb-1">停用藥物</h3>
            <p className="text-xs text-natural-400 mb-4">{(patient.medications || []).find(m => m.id === stoppingMedId)?.name}</p>
            <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1.5">停藥原因（選填）</label>
            <input
              value={stopReason}
              onChange={e => setStopReason(e.target.value)}
              placeholder="例：劑量調整、副作用、療程結束…"
              className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setStoppingMedId(null)} className="px-4 py-2 text-xs font-bold text-natural-400 hover:text-natural-600">取消</button>
              <button onClick={stopMed} className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-bold">確認停用</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Medication Add/Edit Modal ── */}
      {showMedModal && (
        <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 border border-natural-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-natural-900">{editingMedId ? '編輯用藥' : '新增用藥'}</h3>
              <button onClick={() => setShowMedModal(false)} className="text-natural-300 hover:text-natural-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">藥物名稱 *</label>
                <input value={medForm.name} onChange={e => setMedForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="例：Amoxicillin" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">劑量</label>
                  <input value={medForm.dose} onChange={e => setMedForm(p => ({ ...p, dose: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="500mg" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">頻率</label>
                  <input value={medForm.frequency} onChange={e => setMedForm(p => ({ ...p, frequency: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="BID" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">給藥途徑</label>
                  <input value={medForm.route} onChange={e => setMedForm(p => ({ ...p, route: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="PO / IV / IM" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">開始日期</label>
                  <input type="date" value={medForm.startDate} onChange={e => setMedForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowMedModal(false)} className="px-4 py-2 text-xs font-bold text-natural-400 hover:text-natural-600">取消</button>
              <button onClick={saveMed} disabled={!medForm.name.trim()} className="px-5 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold">儲存</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Lab Add/Edit Modal ── */}
      {showLabModal && (
        <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 border border-natural-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-natural-900">{editingLabId ? '編輯檢驗' : '新增檢驗'}</h3>
              <button onClick={() => setShowLabModal(false)} className="text-natural-300 hover:text-natural-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">項目名稱 *</label>
                <input value={labForm.name} onChange={e => setLabForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="CBC / BUN…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">分類</label>
                  <select value={labForm.category} onChange={e => setLabForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden">
                    {LAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">採檢日期</label>
                  <input type="date" value={labForm.orderedDate} onChange={e => setLabForm(p => ({ ...p, orderedDate: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">結果數值</label>
                  <input value={labForm.value} onChange={e => setLabForm(p => ({ ...p, value: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="13.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">單位</label>
                  <input value={labForm.unit} onChange={e => setLabForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="g/dL" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">參考範圍</label>
                  <input value={labForm.referenceRange} onChange={e => setLabForm(p => ({ ...p, referenceRange: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="12–16" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">回報日期</label>
                  <input type="date" value={labForm.resultDate} onChange={e => setLabForm(p => ({ ...p, resultDate: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">數值判讀</label>
                  <div className="flex rounded-lg overflow-hidden border border-natural-200 text-[10px] font-bold h-[38px]">
                    <button type="button" onClick={() => setLabForm(p => ({ ...p, isAbnormal: false, abnormalDir: '' }))} className={`flex-1 transition-all ${!labForm.isAbnormal ? 'bg-natural-600 text-white' : 'text-natural-400 hover:bg-natural-50'}`}>正常</button>
                    <button type="button" onClick={() => setLabForm(p => ({ ...p, isAbnormal: true, abnormalDir: 'H' }))} className={`flex-1 transition-all border-x border-natural-200 ${labForm.abnormalDir === 'H' ? 'bg-terracotta-500 text-white' : 'text-natural-400 hover:bg-natural-50'}`}>偏高 H</button>
                    <button type="button" onClick={() => setLabForm(p => ({ ...p, isAbnormal: true, abnormalDir: 'L' }))} className={`flex-1 transition-all ${labForm.abnormalDir === 'L' ? 'bg-clinical-500 text-white' : 'text-natural-400 hover:bg-natural-50'}`}>偏低 L</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowLabModal(false)} className="px-4 py-2 text-xs font-bold text-natural-400 hover:text-natural-600">取消</button>
              <button onClick={saveLab} disabled={!labForm.name.trim()} className="px-5 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold">儲存</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Examination Add/Edit Modal ── */}
      {showExamModal && (
        <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 border border-natural-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-natural-900">{editingExamId ? '編輯檢查' : '新增檢查'}</h3>
              <button onClick={() => setShowExamModal(false)} className="text-natural-300 hover:text-natural-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">檢查名稱 *</label>
                  <input value={examForm.name} onChange={e => setExamForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" placeholder="CT Neck / CXR…" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">開立日期</label>
                  <input type="date" value={examForm.orderedDate} onChange={e => setExamForm(p => ({ ...p, orderedDate: e.target.value }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">狀態</label>
                <select value={examForm.status} onChange={e => setExamForm(p => ({ ...p, status: e.target.value as Examination['status'] }))} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden">
                  <option value="pending">待報告</option>
                  <option value="resulted">已回報</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1">檢查結果 / 描述</label>
                <textarea value={examForm.finding} onChange={e => setExamForm(p => ({ ...p, finding: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-xl text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden resize-none" placeholder="例：No obvious lesion. / Right lung opacity noted." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowExamModal(false)} className="px-4 py-2 text-xs font-bold text-natural-400 hover:text-natural-600">取消</button>
              <button onClick={saveExam} disabled={!examForm.name.trim()} className="px-5 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold">儲存</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function DropdownSelect({
  value,
  onChange,
  options,
  compact = false,
  bare = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; triggerClass: string; dotColor: string }[];
  compact?: boolean;
  /** 只顯示文字（無點、無邊框），給性別這種已經用顏色表示的欄位 */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const current = options.find(o => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        title={current.label}
        className={compact
          ? `w-2.5 h-2.5 rounded-full ${current.dotColor} ring-2 ring-offset-1 ring-transparent hover:ring-current transition-all`
          : bare
            ? 'text-sm font-bold text-natural-500 hover:text-natural-800 transition-colors'
            : `flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold tracking-wide transition-all ${current.triggerClass}`}
      >
        {!compact && !bare && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dotColor}`} />}
        {!compact && current.label}
        {!compact && !bare && <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 left-0 bg-white rounded-xl border border-natural-200 shadow-xl overflow-hidden z-50 min-w-max"
          >
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-left transition-colors hover:bg-natural-50 ${
                  o.value === value ? 'bg-natural-50' : ''
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${o.dotColor}`} />
                <span className={o.value === value ? 'text-natural-900' : 'text-natural-500'}>{o.label}</span>
                {o.value === value && <CheckIcon className="w-3.5 h-3.5 ml-auto text-sage-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

