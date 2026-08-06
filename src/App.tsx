import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  LogOut,
  Ear,
  ClipboardList,
  ChevronRight,
  Stethoscope,
  Menu,
  FileUp,
  LogIn,
  Loader2,
  Trash2,
  ClipboardPaste,
  MoreVertical,
  Hash,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Activity,
  DoorOpen,
  Check,
  Pencil,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, ENTChecklist } from './types';
import PatientDetails from './components/PatientDetails';
import PatientForm from './components/PatientForm';
import ImportModal from './components/ImportModal';
import TodaySchedule from './components/TodaySchedule';
import { db, auth, loginWithGoogle, logout } from './lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  orderBy,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { differenceInCalendarDays } from 'date-fns';

// 床號標籤顯示狀態，性別靠姓名的顏色表達
const GENDER_TEXT: Record<string, string> = {
  Male: 'text-clinical-700',
  Female: 'text-blush-600',
  Other: 'text-natural-500',
};

// 排序用的臨床優先序（與 STATUS_TONE 的顯示順序無關）
const STATUS_ORDER: Record<string, number> = {
  Critical: 0,
  Stable: 1,
  'Discharge Pending': 2,
  Discharged: 3,
};

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

const byBed = (a: Patient, b: Patient) =>
  a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true });

// dot 給彈窗用，chip 給清單上的床號標籤用（只有框線和字帶色，不填底）
const STATUS_TONE: Record<string, { label: string; dot: string; chip: string }> = {
  // 框線用飽和色 + 半透明：色相夠鮮，明度還是淡的
  Stable: { label: 'Stable', dot: 'bg-sage-400', chip: 'text-sage-700 border-sage-500/45' },
  Critical: { label: 'Critical', dot: 'bg-terracotta-500', chip: 'text-terracotta-700 border-terracotta-500/45' },
  'Discharge Pending': { label: 'Discharge Pending', dot: 'bg-clinical-500', chip: 'text-clinical-700 border-clinical-500/45' },
  Discharged: { label: 'Discharged', dot: 'bg-natural-300', chip: 'text-natural-500 border-natural-400/40' },
};
const STATUS_VALUES = Object.keys(STATUS_TONE) as Patient['status'][];

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');   // ponytail: 搜尋 UI 先收起來，過濾邏輯留著，要用時把 topbar 那段貼回來就好
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  // 提到 App：從排程點進病患再返回時，分頁狀態要留著
  const [scheduleTab, setScheduleTab] = useState<'op' | 'todo'>('op');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDischarged, setShowDischarged] = useState(false);
  const [showPatientSwitcher, setShowPatientSwitcher] = useState(false);
  const [sortBy, setSortBy] = useState<'bed' | 'status' | 'admission'>('bed');
  const [sortAsc, setSortAsc] = useState(true);
  const [showSort, setShowSort] = useState(false);
  // 病患內頁的兩顆 topbar 按鈕
  const [editHeader, setEditHeader] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  useEffect(() => { setEditHeader(false); setJsonOpen(false); }, [selectedPatientId]);

  // 手機的返回鍵/手勢：進病患內頁時推一筆 history，返回就退回清單而不是離開 app
  const detailOpen = useRef(false);
  const fromPop = useRef(false);
  useEffect(() => {
    const onPop = () => { fromPop.current = true; setSelectedPatientId(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const open = !!selectedPatientId;
    // 換病患（A→B）時 open 沒變，不會多推也不會多退
    if (open && !detailOpen.current) history.pushState({ patientDetail: true }, '');
    else if (!open && detailOpen.current && !fromPop.current) history.back();  // 用 app 內的返回離開，把那筆收回來
    detailOpen.current = open;
    fromPop.current = false;
  }, [selectedPatientId]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastImportIds, setLastImportIds] = useState<string[] | null>(null);
  const [lastDischarged, setLastDischarged] = useState<{ id: string; status: Patient['status'] }[]>([]);
  const [undoStatus, setUndoStatus] = useState<{ id: string; name: string; prev: Patient['status'] } | null>(null);
  const [dischargePlan, setDischargePlan] = useState<{ id: string; name: string; date: string } | null>(null);
  const [statusPick, setStatusPick] = useState<{ patient: Patient; sel: Patient['status'] } | null>(null);
  const [justDischarged, setJustDischarged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setPatients([]);
      return;
    }

    const q = query(
      collection(db, 'patients'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientData: Patient[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.dailyChecks) {
          // 匯入的紀錄可能缺 date/notes。缺 date 會讓 sort 與 date-fns format 直接 throw → 整個 app 白屏。
          // 這裡是唯一的讀取點，補在這裡下游就都乾淨。
          data.dailyChecks = [...data.dailyChecks]
            .map((c: any) => ({
              ...c,
              date: isNaN(Date.parse(c.date)) ? new Date(0).toISOString() : c.date,
              notes: Array.isArray(c.notes) ? c.notes : [],
            }))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        patientData.push({
          medications: [],
          labTests: [],
          examinations: [],
          ...data,
          diagnosis: data.diagnosis || data.admissionDiagnosis || '',
          id: doc.id,
        } as Patient);
      });
      setPatients(patientData);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // 剛按出院的先留在清單上，重整後才歸到出院清單 —— 免得點下去人就不見了
  const stillHere = (p: Patient) => p.status !== 'Discharged' || justDischarged.has(p.id);

  const filteredPatients = patients.filter(p => {
    if (showDischarged) return p.status === 'Discharged';
    return stillHere(p) && (
      p.name.includes(searchTerm) ||
      p.bedNumber.includes(searchTerm) ||
      p.chartNumber.includes(searchTerm)
    );
  });
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const v = sortBy === 'bed' ? byBed(a, b)
      : sortBy === 'admission' ? (a.admissionDate || '').localeCompare(b.admissionDate || '') || byBed(a, b)
      : ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)) || byBed(a, b);
    return sortAsc ? v : -v;
  });

  const dischargedCount = patients.filter(p => p.status === 'Discharged').length;
  const activeCount = patients.filter(stillHere).length;

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    if (!user) return;
    try {
      const patientRef = doc(db, 'patients', updatedPatient.id);

      const {
        name, bedNumber, age, gender, chartNumber,
        admissionDate, diagnosis, status, dailyChecks,
        medications, labTests, examinations, briefing,
        opDate, opProcedure,
      } = updatedPatient;

      // Firestore rejects undefined values — strip them via JSON round-trip
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean = (v: any) => JSON.parse(JSON.stringify(v));

      await updateDoc(patientRef, {
        name, bedNumber, age, gender, chartNumber,
        admissionDate, diagnosis, status,
        briefing: briefing ?? '',
        opDate: opDate ?? '',
        opProcedure: opProcedure ?? '',
        dailyChecks: clean(dailyChecks || []),
        medications: clean(medications || []),
        labTests: clean(labTests || []),
        examinations: clean(examinations || []),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating patient:", error);
      alert(`儲存失敗：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 清單上直接改狀態，不用進病患內頁
  const handleStatusChange = async (patient: Patient, status: Patient['status']) => {
    setStatusPick(null);
    if (status === patient.status) return;
    // 先開 UI 再寫入：await updateDoc 要等 server ack，接著開彈窗會卡好幾百毫秒
    // 準出院就順手問預計出院日，不確定可以取消不填
    if (status === 'Discharge Pending') {
      setDischargePlan({ id: patient.id, name: patient.name, date: patient.dischargeDate || '' });
    }
    // 出院的留在清單上到下次重整，另外給一條可復原的提示
    if (status === 'Discharged') {
      setUndoStatus({ id: patient.id, name: patient.name, prev: patient.status });
      setJustDischarged(s => new Set(s).add(patient.id));
    }
    // 不再準備出院了，原本排的出院日就沒意義，一起清掉
    const clearDate = patient.dischargeDate && status !== 'Discharge Pending' && status !== 'Discharged';
    try {
      await updateDoc(doc(db, 'patients', patient.id), {
        status,
        ...(clearDate ? { dischargeDate: '' } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert('狀態更新失敗，請稍後再試。');
    }
  };

  // date 傳 '' 就是刪掉出院日
  const handleDischargeDate = async (date: string) => {
    if (!dischargePlan) return;
    const { id } = dischargePlan;
    setDischargePlan(null);   // 同上，不要等寫入回來才關窗
    try {
      await updateDoc(doc(db, 'patients', id), { dischargeDate: date, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Error setting discharge date:", error);
      alert('出院日儲存失敗，請稍後再試。');
    }
  };

  const handleUndoStatus = async () => {
    if (!undoStatus) return;
    try {
      await updateDoc(doc(db, 'patients', undoStatus.id), { status: undoStatus.prev, updatedAt: serverTimestamp() });
      setUndoStatus(null);
    } catch (error) {
      console.error("Error undoing status:", error);
      alert('復原失敗，請稍後再試。');
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!user) return;
    if (confirm('確定要刪除這位病患嗎？這是不能復原的。')) {
      try {
        await deleteDoc(doc(db, 'patients', id));
        setSelectedPatientId(null);
      } catch (error) {
        console.error("Error deleting patient:", error);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (!user || selectedIds.size === 0) return;
    if (!confirm(`確定要刪除選取的 ${selectedIds.size} 位病患？此操作無法復原。`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.delete(doc(db, 'patients', id)));
      await batch.commit();
      setSelectedIds(new Set());
      setIsEditMode(false);
    } catch (error) {
      console.error("Error batch deleting:", error);
    }
  };

  const handleAddPatient = async (newPatientData: Omit<Patient, 'id'>) => {
    if (!user) return;
    try {
      const patientsRef = collection(db, 'patients');
      const newDocRef = doc(patientsRef);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean = (v: any) => JSON.parse(JSON.stringify(v));
      await setDoc(newDocRef, {
        ...clean({ ...newPatientData, id: newDocRef.id, ownerId: user.uid }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding patient:", error);
      alert('新增失敗，請稍後再試。');
    }
  };

  const handleBatchImport = async (importedPatients: Patient[], isFullList = false) => {
    if (!user) return;
    try {
      const existingChartNos = new Set(patients.map(p => p.chartNumber));
      const toImport = importedPatients.filter(p => !existingChartNos.has(p.chartNumber));
      const skipped = importedPatients.length - toImport.length;

      // 截圖 = 最新的完整清單：在院但沒出現在清單裡的，視為已出院
      // 沒病歷號的病患不比對（手動新增的可能留空），避免誤判出院
      const importedChartNos = new Set(importedPatients.map(p => p.chartNumber));
      const toDischarge = isFullList
        ? patients.filter(p => p.status !== 'Discharged' && p.chartNumber && !importedChartNos.has(p.chartNumber))
        : [];

      if (toImport.length === 0 && toDischarge.length === 0) {
        alert(`所有 ${importedPatients.length} 位病患已存在（依病歷號比對），略過匯入。`);
        setShowImportModal(false);
        return;
      }

      if (toDischarge.length > 0 &&
          !confirm(`以下 ${toDischarge.length} 位病患未出現在此清單中，將標記為出院：\n\n${toDischarge.map(p => `${p.bedNumber} ${p.name}`).join('\n')}`)) {
        return;
      }

      const batch = writeBatch(db);
      const patientsRef = collection(db, 'patients');
      const importedIds: string[] = [];
      for (const patient of toImport) {
        const newDocRef = doc(patientsRef);
        importedIds.push(newDocRef.id);
        batch.set(newDocRef, {
          ...patient,
          id: newDocRef.id,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      toDischarge.forEach(p =>
        batch.update(doc(db, 'patients', p.id), { status: 'Discharged', updatedAt: serverTimestamp() })
      );
      await batch.commit();
      setLastImportIds(importedIds);
      setLastDischarged(toDischarge.map(p => ({ id: p.id, status: p.status })));
      setShowImportModal(false);
      alert(`成功匯入 ${toImport.length} 位病患${skipped > 0 ? `，略過 ${skipped} 位已存在病患` : ''}${toDischarge.length > 0 ? `，${toDischarge.length} 位轉為出院` : ''}。`);
    } catch (error) {
      console.error("Error batch importing:", error);
    }
  };

  const handleUndoImport = async () => {
    if (!lastImportIds) return;
    try {
      const batch = writeBatch(db);
      lastImportIds.forEach(id => batch.delete(doc(db, 'patients', id)));
      lastDischarged.forEach(({ id, status }) =>
        batch.update(doc(db, 'patients', id), { status, updatedAt: serverTimestamp() })
      );
      await batch.commit();
      setLastImportIds(null);
      setLastDischarged([]);
    } catch (error) {
      console.error("Error undoing import:", error);
      alert('撤銷失敗，請稍後再試。');
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-natural-50">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-natural-50 p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-xl border border-natural-200 text-center">
          <div className="w-20 h-20 bg-sage-500 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-8">
            <Ear className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-natural-900 mb-4 tracking-tight">ENT 住院端</h1>
          <p className="text-natural-500 mb-10 leading-relaxed font-serif italic text-lg">
            "Precision in every round, clarity in every chart."
          </p>
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-natural-200 text-natural-700 py-4 rounded-xl font-bold hover:bg-natural-50 transition-all hover:border-sage-500 group"
          >
            <LogIn className="w-5 h-5 text-natural-400 group-hover:text-sage-500 transition-colors" />
            使用 Google 帳號登入
          </button>
          <p className="mt-8 text-[10px] uppercase font-bold tracking-widest text-natural-300">
            Secure Medical Professional Access Only
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-natural-50 overflow-hidden font-sans text-natural-600">
      {/* Main Content */}
      <main className="h-full flex flex-col overflow-hidden relative">
        <header className="h-14 sm:h-16 bg-white border-b border-natural-200 px-2 sm:px-6 flex items-center gap-2 sm:gap-4 justify-between shrink-0 shadow-sm z-10">
          {/* Left: menu + nav context（病患內頁時右側動作靠右） */}
          <div className={`flex items-center gap-1 sm:gap-3 ${selectedPatientId ? 'flex-1 min-w-0' : 'shrink-0'}`}>
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 rounded-lg text-natural-400 hover:text-natural-700 hover:bg-natural-100 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            {selectedPatientId ? (
              <>
                <button
                  onClick={() => setSelectedPatientId(null)}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-natural-400 hover:text-sage-600 group transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="hidden sm:inline">返回</span>
                </button>
                <span className="text-natural-200 mx-2 sm:mx-3">|</span>
                <button
                  onClick={() => setShowPatientSwitcher(true)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-natural-400 hover:text-sage-600 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">切換</span>
                </button>

                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    onClick={() => setJsonOpen(true)}
                    title="貼上 JSON 更新病患資料"
                    className="p-2 rounded-lg text-natural-400 hover:text-sage-600 hover:bg-natural-100 transition-colors"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                  </button>
                  {editHeader && (
                    <button
                      onClick={() => handleDeletePatient(selectedPatientId)}
                      title="刪除病患"
                      className="p-2 rounded-lg text-natural-400 hover:text-terracotta-500 hover:bg-natural-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditHeader(e => !e)}
                    title={editHeader ? '完成編輯' : '編輯基本資料'}
                    className={`p-2 rounded-lg transition-colors ${
                      editHeader ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:text-sage-600 hover:bg-natural-100'
                    }`}
                  >
                    {editHeader ? <Check className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-natural-500">
                {showSchedule ? '今日排程' : showDischarged ? '出院清單' : '病患列表'}
                {!showSchedule && (
                  <span className="text-[10px] text-natural-300">{showDischarged ? dischargedCount : activeCount}</span>
                )}
              </span>
            )}
          </div>

          {/* Right: actions（病患內頁不需要，全部收起）。搜尋列先收起來，沒在用 */}
          <div className={`flex items-center gap-3 sm:gap-5 min-w-0 flex-1 justify-end ${selectedPatientId ? 'hidden' : ''}`}>
            {!selectedPatientId && !showSchedule && (
              <button
                onClick={() => setShowSort(s => !s)}
                title="排序"
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  showSort ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:text-natural-700 hover:bg-natural-100'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            )}
            {!selectedPatientId && !showSchedule && (
              <button
                onClick={() => (isEditMode ? exitEditMode() : setIsEditMode(true))}
                title={isEditMode ? '完成' : '編輯'}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  isEditMode ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:text-natural-700 hover:bg-natural-100'
                }`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {/* 手動新增收進匯入彈窗裡，日常都是截圖匯入 */}
            <button
              onClick={() => setShowImportModal(true)}
              title="匯入"
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold bg-sage-500 text-white hover:bg-sage-600 shadow-sm transition-all shrink-0"
            >
              <FileUp className="w-3.5 h-3.5" /><span className="hidden sm:inline">匯入</span>
            </button>
          </div>
        </header>

        {showAddForm && (
          <PatientForm 
            onSubmit={handleAddPatient} 
            onCancel={() => setShowAddForm(false)} 
          />
        )}

        {showImportModal && (
          <ImportModal
            onImport={handleBatchImport}
            onCancel={() => setShowImportModal(false)}
            onManualAdd={() => { setShowImportModal(false); setShowAddForm(true); }}
          />
        )}

        <AnimatePresence>
          {lastImportIds && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-8 mt-4 flex items-center justify-between bg-sage-50 border border-sage-200 rounded-xl px-5 py-3 text-sm"
            >
              <span className="text-sage-800 font-medium">
                已匯入 {lastImportIds.length} 位病患{lastDischarged.length > 0 && `，${lastDischarged.length} 位轉為出院`}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUndoImport}
                  className="text-xs font-bold text-terracotta-600 hover:text-terracotta-800 transition-colors"
                >
                  撤銷匯入
                </button>
                <button
                  onClick={() => setLastImportIds(null)}
                  className="text-natural-400 hover:text-natural-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {undoStatus && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-3 sm:mx-8 mt-4 flex items-center justify-between bg-clay-50 border border-clay-200 rounded-xl px-5 py-3 text-sm"
            >
              <span className="text-clay-800 font-medium">已將 {undoStatus.name} 標記為出院</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUndoStatus}
                  className="text-xs font-bold text-terracotta-600 hover:text-terracotta-800 transition-colors"
                >
                  復原
                </button>
                <button
                  onClick={() => setUndoStatus(null)}
                  className="text-natural-400 hover:text-natural-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {statusPick && (
          <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setStatusPick(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-natural-200 p-4 space-y-1"
            >
              {STATUS_VALUES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusPick({ ...statusPick, sel: s })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    s === statusPick.sel ? 'bg-sage-50 text-sage-700' : 'text-natural-600 hover:bg-natural-50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_TONE[s].dot}`} />
                  {STATUS_TONE[s].label}
                  {s === statusPick.sel && <Check className="w-4 h-4 ml-auto text-sage-500" />}
                </button>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="flex-1 min-w-0 truncate px-4 text-[10px] font-bold uppercase tracking-widest text-natural-300">
                  {statusPick.patient.name}
                </span>
                <button
                  onClick={() => setStatusPick(null)}
                  className="px-4 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => handleStatusChange(statusPick.patient, statusPick.sel)}
                  className="bg-sage-500 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-sage-600 transition-all"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {dischargePlan && (
          <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDischargePlan(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-natural-200 p-6 space-y-5"
            >
              <div>
                <h3 className="text-lg font-serif font-bold text-natural-900">預計出院日</h3>
                <p className="text-[10px] text-natural-400 font-bold uppercase tracking-widest mt-1">{dischargePlan.name}</p>
              </div>
              <input
                type="date"
                autoFocus
                value={dischargePlan.date}
                onChange={(e) => setDischargePlan({ ...dischargePlan, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-natural-200 bg-natural-50 text-sm text-natural-800 outline-hidden focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all"
              />
              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={() => handleDischargeDate('')}
                  className="px-4 py-2.5 rounded-lg text-terracotta-500 font-bold text-xs uppercase tracking-widest hover:text-terracotta-700 transition-all"
                >
                  刪除
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDischargePlan(null)}
                    className="px-4 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDischargeDate(dischargePlan.date)}
                    disabled={!dischargePlan.date}
                    className="bg-sage-500 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-sage-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    儲存
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-2.5 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {!selectedPatientId && showSchedule ? (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <TodaySchedule
                  patients={patients}
                  onSelect={setSelectedPatientId}
                  tab={scheduleTab}
                  onTabChange={setScheduleTab}
                />
              </motion.div>
            ) : !selectedPatientId ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* 排序列：獨立在清單卡片之外，由 topbar 的按鈕展開 */}
                {showSort && (
                  <div className="flex items-center gap-1 px-1 pb-2">
                    {([['bed', '床號排序', <Hash key="i" className="w-4 h-4" />],
                       ['status', '狀態排序', <Activity key="i" className="w-4 h-4" />],
                       ['admission', '住院日排序', <Clock key="i" className="w-4 h-4" />]] as const).map(([key, label, icon]) => (
                      <button
                        key={key}
                        onClick={() => setSortBy(key)}
                        title={label}
                        className={`p-1.5 rounded-lg transition-colors ${
                          sortBy === key ? 'bg-sage-100 text-sage-700' : 'text-natural-300 hover:text-natural-600'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                    <button
                      onClick={() => setSortAsc(a => !a)}
                      title={sortAsc ? '正序' : '倒序'}
                      className="p-1.5 rounded-lg text-natural-400 hover:text-sage-600 transition-colors ml-1"
                    >
                      {sortAsc ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                {sortedPatients.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-natural-200 shadow-sm py-20 text-center">
                    <Users className="w-10 h-10 text-natural-200 mx-auto mb-3" />
                    <p className="text-natural-400 font-bold uppercase tracking-widest text-xs">尚無病患資料</p>
                  </div>
                ) : (
                  sortedPatients.map(patient => {
                    const isSelected = selectedIds.has(patient.id);
                    const status = STATUS_TONE[patient.status] ?? STATUS_TONE.Discharged;
                    // 手術當天 = POD 0。T00:00 解析成當地午夜，跨時區不會差一天
                    const opDay = patient.opDate ? new Date(patient.opDate + 'T00:00') : null;
                    const pod = opDay && !isNaN(opDay.getTime())
                      ? differenceInCalendarDays(new Date(), opDay)
                      : null;
                    // 還沒開的刀講 POD -3 很怪，直接寫日期跟星期
                    const opLabel = pod === null ? null
                      : pod < 0 ? `OP ${patient.opDate!.slice(5).replace('-', '/')} (${WEEKDAY[opDay!.getDay()]})`
                      : `POD ${pod}`;
                    return (
                      <div key={patient.id} className="bg-white rounded-lg border border-natural-200 shadow-xs overflow-hidden">
                        <div
                          onClick={isEditMode ? () => toggleSelect(patient.id) : undefined}
                          className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3.5 sm:py-4 transition-colors ${
                            isEditMode ? `cursor-pointer ${isSelected ? 'bg-terracotta-50' : 'hover:bg-natural-50'}` : ''
                          }`}
                        >
                          {isEditMode && (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'bg-terracotta-500 border-terracotta-500' : 'border-natural-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                          )}
                          {/* 兩行拆開：POD/狀態只佔第一行，診斷那行才能用滿整列寬度 */}
                          <div className="flex-1 min-w-0 -mx-1 px-1 rounded-lg hover:bg-sage-50/50 transition-colors">
                            <div className="flex items-center gap-2 sm:gap-3">
                              {/* 床號 = 狀態：顏色顯示狀態，點一下開狀態彈窗 */}
                              <button
                                disabled={isEditMode}
                                onClick={() => setStatusPick({ patient, sel: patient.status })}
                                title={`${status.label}（點擊變更）`}
                                className={`px-2 py-0.5 rounded border-2 text-xs font-bold uppercase tracking-wider shrink-0 min-w-16 text-center whitespace-nowrap transition-colors disabled:pointer-events-none ${status.chip}`}
                              >
                                {patient.bedNumber}
                              </button>
                              <button
                                disabled={isEditMode}
                                onClick={() => setSelectedPatientId(patient.id)}
                                className="flex-1 min-w-0 text-left disabled:pointer-events-none"
                              >
                                <div className="flex items-baseline gap-3 sm:gap-4 flex-wrap">
                                  {/* 姓名的顏色就是性別，M/F 那個字省掉 */}
                                  <span className={`truncate ${GENDER_TEXT[patient.gender] ?? GENDER_TEXT.Other}`}>
                                    {patient.name}
                                  </span>
                                  <span className="text-xs text-natural-400 shrink-0">{patient.age}</span>
                                </div>
                              </button>
                              {/* 出院日在左、POD 固定壓在最右邊 */}
                              {patient.dischargeDate && (
                                <button
                                  disabled={isEditMode}
                                  onClick={() => setDischargePlan({ id: patient.id, name: patient.name, date: patient.dischargeDate! })}
                                  className="shrink-0 px-2 py-0.5 rounded-full border border-clinical-100 bg-clinical-50 text-clinical-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap disabled:pointer-events-none"
                                  title="預計出院日（點擊修改）"
                                >
                                  出院 {patient.dischargeDate.slice(5).replace('-', '/')}
                                </button>
                              )}
                              {opLabel && (
                                <span
                                  className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                                    // 今天開或還沒開 → 深色提醒；術後同色系但淡一階
                                    pod! <= 0 ? 'bg-clay-100 border-clay-300 text-clay-700' : 'bg-clay-50 border-clay-200 text-clay-500'
                                  }`}
                                  title={`手術日 ${patient.opDate}${patient.opProcedure ? `：${patient.opProcedure}` : ''}`}
                                >
                                  {opLabel}
                                </span>
                              )}
                            </div>
                            <button
                              disabled={isEditMode}
                              onClick={() => setSelectedPatientId(patient.id)}
                              className="block w-full text-left disabled:pointer-events-none"
                            >
                              <p className="text-xs text-natural-500 truncate mt-1">{patient.diagnosis || '—'}</p>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </motion.div>
            ) : selectedPatient ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-6xl mx-auto"
              >
                <PatientDetails
                  patient={selectedPatient}
                  onUpdate={handleUpdatePatient}
                  onDelete={handleDeletePatient}
                  editHeader={editHeader}
                  jsonOpen={jsonOpen}
                  onCloseJson={() => setJsonOpen(false)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Sidebar overlay */}
        <AnimatePresence>
          {showSidebar && (
            <>
              <div className="fixed inset-0 bg-natural-900/20 z-40" onClick={() => setShowSidebar(false)} />
              <motion.nav
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="fixed top-0 left-0 bottom-0 w-64 bg-natural-100 border-r border-natural-200 flex flex-col z-50 shadow-2xl"
              >
                <div className="p-6 flex items-center gap-3 border-b border-natural-200">
                  <div className="p-2 bg-sage-500 rounded-lg shadow-sm shrink-0">
                    <Ear className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-natural-900 leading-none">ENT 住院</h1>
                    <p className="text-[10px] uppercase tracking-widest text-natural-400 font-bold mt-0.5">Rounding System</p>
                  </div>
                  <button onClick={() => setShowSidebar(false)} className="ml-auto text-natural-300 hover:text-natural-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 px-3 py-4 space-y-1">
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      !selectedPatientId && !showSchedule && !showDischarged ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:bg-white hover:text-natural-600'
                    }`}
                    onClick={() => { setSelectedPatientId(null); setShowSchedule(false); setShowDischarged(false); setIsEditMode(false); setShowSidebar(false); }}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    病患列表
                    <span className="ml-auto text-[10px] text-natural-300">{activeCount}</span>
                  </button>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      !selectedPatientId && showSchedule ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:bg-white hover:text-natural-600'
                    }`}
                    onClick={() => { setSelectedPatientId(null); setShowSchedule(true); setIsEditMode(false); setShowSidebar(false); }}
                  >
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    今日排程
                  </button>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      !selectedPatientId && !showSchedule && showDischarged ? 'bg-sage-100 text-sage-700' : 'text-natural-400 hover:bg-white hover:text-natural-600'
                    }`}
                    onClick={() => { setSelectedPatientId(null); setShowSchedule(false); setShowDischarged(true); setIsEditMode(false); setShowSidebar(false); }}
                  >
                    <DoorOpen className="w-4 h-4 shrink-0" />
                    出院清單
                    <span className="ml-auto text-[10px] text-natural-300">{dischargedCount}</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-natural-400 hover:bg-white hover:text-natural-600 transition-all">
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    臨床指引
                  </button>
                </div>

                <div className="p-4 border-t border-natural-200">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-natural-200 mb-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-natural-100 shrink-0 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center font-bold text-sage-700 text-xs shrink-0">
                        {user.displayName?.charAt(0) || 'D'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-natural-900 truncate">{user.displayName || 'Doctor'}</p>
                      <p className="text-[10px] text-natural-400 uppercase truncate">ENT Specialist</p>
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 text-natural-400 hover:text-terracotta-500 text-xs font-bold transition-colors py-2"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    登出系統
                  </button>
                </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPatientSwitcher && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPatientSwitcher(false)} />
              <motion.div
                initial={{ x: -288 }}
                animate={{ x: 0 }}
                exit={{ x: -288 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="fixed top-16 left-0 bottom-0 w-72 bg-white border-r border-natural-200 shadow-2xl z-50 flex flex-col"
              >
                <div className="px-5 py-4 border-b border-natural-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-natural-400 uppercase tracking-widest">切換病患</p>
                  <button onClick={() => setShowPatientSwitcher(false)} className="text-natural-300 hover:text-natural-600 transition-colors text-xs font-bold">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {patients.filter(p => p.status !== 'Discharged').map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => { setSelectedPatientId(patient.id); setShowPatientSwitcher(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors border-b border-natural-50 last:border-b-0 ${
                        patient.id === selectedPatientId ? 'bg-sage-50' : 'hover:bg-natural-50'
                      }`}
                    >
                      <span className="text-[9px] font-bold text-sage-600 bg-sage-50 border border-sage-100 px-1.5 py-0.5 rounded uppercase tracking-wider min-w-12 text-center shrink-0 whitespace-nowrap">
                        {patient.bedNumber}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${patient.id === selectedPatientId ? 'text-sage-700' : 'text-natural-900'}`}>{patient.name}</p>
                        <p className="text-[10px] text-natural-400 truncate">{patient.age}y · {patient.diagnosis?.slice(0, 28)}{(patient.diagnosis?.length ?? 0) > 28 ? '…' : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditMode && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-natural-900 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4 z-50"
            >
              <button
                onClick={() => {
                  const allIds = new Set(filteredPatients.map(p => p.id));
                  const allSelected = filteredPatients.every(p => selectedIds.has(p.id));
                  setSelectedIds(allSelected ? new Set() : allIds);
                }}
                className="text-sm font-bold text-natural-300 hover:text-white transition-colors"
              >
                {filteredPatients.every(p => selectedIds.has(p.id)) ? '取消全選' : '全選'}
              </button>
              <span className="text-natural-500">|</span>
              <span className="text-sm text-natural-300">已選 <span className="text-white font-bold">{selectedIds.size}</span> 位</span>
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                刪除
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
