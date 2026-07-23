import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  LogOut,
  Ear,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Stethoscope,
  Menu,
  FileUp,
  LogIn,
  Loader2,
  Trash2,
  ClipboardPaste,
  MoreVertical,
  Scissors,
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
import { format, addDays } from 'date-fns';

// 與 PatientDetails 的床號標籤同一個樣式
const GENDER_TONE: Record<string, string> = {
  Male: 'bg-clinical-50 text-clinical-700 border-clinical-100',
  Female: 'bg-blush-50 text-blush-600 border-blush-100',
  Other: 'bg-natural-100 text-natural-500 border-natural-200',
};

// 排序用的臨床優先序（與 STATUS_TONE 的顯示順序無關）
const STATUS_ORDER: Record<string, number> = {
  Critical: 0,
  Stable: 1,
  'Discharge Pending': 2,
  Discharged: 3,
};

const byBed = (a: Patient, b: Patient) =>
  a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true });

// label 只當 tooltip 用
const STATUS_TONE: Record<string, { label: string; dot: string }> = {
  Stable: { label: 'Stable', dot: 'bg-sage-400' },
  Critical: { label: 'Critical', dot: 'bg-terracotta-500' },
  'Discharge Pending': { label: 'Discharge Pending', dot: 'bg-clay-400' },
  Discharged: { label: 'Discharged', dot: 'bg-natural-300' },
};

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDischarged, setShowDischarged] = useState(false);
  const [showPatientSwitcher, setShowPatientSwitcher] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const toggleSearch = () => { setShowSearch(s => { if (s) setSearchTerm(''); return !s; }); };
  const [sortBy, setSortBy] = useState<'bed' | 'status' | 'admission'>('bed');
  const [sortAsc, setSortAsc] = useState(true);
  const [showSort, setShowSort] = useState(false);
  // 病患內頁的兩顆 topbar 按鈕
  const [editHeader, setEditHeader] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  useEffect(() => { setEditHeader(false); setJsonOpen(false); }, [selectedPatientId]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastImportIds, setLastImportIds] = useState<string[] | null>(null);

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

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const filteredPatients = patients.filter(p => {
    if (showDischarged) return p.status === 'Discharged';
    return p.status !== 'Discharged' && (
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
  const activeCount = patients.filter(p => p.status !== 'Discharged').length;

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

  const handleBatchImport = async (importedPatients: Patient[]) => {
    if (!user) return;
    try {
      const existingChartNos = new Set(patients.map(p => p.chartNumber));
      const toImport = importedPatients.filter(p => !existingChartNos.has(p.chartNumber));
      const skipped = importedPatients.length - toImport.length;

      if (toImport.length === 0) {
        alert(`所有 ${importedPatients.length} 位病患已存在（依病歷號比對），略過匯入。`);
        setShowImportModal(false);
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
      await batch.commit();
      setLastImportIds(importedIds);
      setShowImportModal(false);
      alert(`成功匯入 ${toImport.length} 位病患${skipped > 0 ? `，略過 ${skipped} 位已存在病患` : ''}。`);
    } catch (error) {
      console.error("Error batch importing:", error);
    }
  };

  const handleUndoImport = async () => {
    if (!lastImportIds || lastImportIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      lastImportIds.forEach(id => batch.delete(doc(db, 'patients', id)));
      await batch.commit();
      setLastImportIds(null);
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

          {/* Right: search + actions（病患內頁不需要，全部收起） */}
          <div className={`flex items-center gap-1 sm:gap-2 min-w-0 flex-1 justify-end ${selectedPatientId ? 'hidden' : ''}`}>
            {/* Expandable search */}
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
              <AnimatePresence>
                {showSearch && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '100%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden max-w-[220px]"
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="搜尋姓名/床號/病歷號"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
                      className="w-full px-3 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={toggleSearch}
                className="p-2 rounded-lg text-natural-400 hover:text-natural-700 hover:bg-natural-100 transition-colors shrink-0"
              >
                {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

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
              isEditMode ? (
                <button onClick={exitEditMode} className="px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-natural-100 text-natural-600 border border-natural-200 hover:bg-natural-200 transition-all shrink-0">完成</button>
              ) : (
                <button onClick={() => setIsEditMode(true)} title="編輯" className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold bg-natural-100 text-natural-600 border border-natural-200 hover:bg-natural-200 transition-all shrink-0">
                  <Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">編輯</span>
                </button>
              )
            )}
            <button onClick={() => setShowImportModal(true)} title="匯入" className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold bg-natural-100 text-natural-600 border border-natural-200 hover:bg-natural-200 transition-all shrink-0">
              <FileUp className="w-3.5 h-3.5" /><span className="hidden sm:inline">匯入</span>
            </button>
            <button onClick={() => setShowAddForm(true)} title="新增病患" className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs font-bold bg-sage-500 text-white hover:bg-sage-600 transition-all shadow-sm shrink-0">
              <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">新增病患</span>
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
              <span className="text-sage-800 font-medium">已匯入 {lastImportIds.length} 位病患</span>
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
        </AnimatePresence>

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
                  onSelect={(id) => { setSelectedPatientId(id); setShowSchedule(false); }}
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

                <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
                {sortedPatients.length === 0 ? (
                  <div className="py-20 text-center">
                    <Users className="w-10 h-10 text-natural-200 mx-auto mb-3" />
                    <p className="text-natural-400 font-bold uppercase tracking-widest text-xs">尚無病患資料</p>
                  </div>
                ) : (
                  sortedPatients.map(patient => {
                    const isSelected = selectedIds.has(patient.id);
                    const isExpanded = expandedIds.has(patient.id);
                    const status = STATUS_TONE[patient.status] ?? STATUS_TONE.Discharged;
                    const abnormals = patient.labTests?.filter(l => l.isAbnormal) ?? [];
                    const lastCheck = patient.dailyChecks?.length
                      ? [...patient.dailyChecks].sort((a, b) => b.date.localeCompare(a.date))[0]
                      : null;
                    return (
                      <div key={patient.id} className="border-b border-natural-50 last:border-b-0">
                        <div
                          onClick={isEditMode ? () => toggleSelect(patient.id) : undefined}
                          className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors ${
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
                          {/* Main info — navigate on click in normal mode */}
                          <button
                            disabled={isEditMode}
                            onClick={() => setSelectedPatientId(patient.id)}
                            className="flex-1 min-w-0 text-left group hover:bg-sage-50/50 -mx-1 px-1 rounded-lg transition-colors disabled:pointer-events-none"
                          >
                            <div className="flex items-baseline gap-3 sm:gap-4 flex-wrap">
                              <span className={`px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wider shrink-0 w-16 text-center ${GENDER_TONE[patient.gender] ?? GENDER_TONE.Other}`}>
                                {patient.bedNumber}
                              </span>
                              <span className="text-natural-900 truncate">{patient.name}</span>
                              <span className="text-xs text-natural-400 shrink-0">
                                {patient.age} {patient.gender === 'Female' ? 'F' : patient.gender === 'Other' ? 'O' : 'M'}
                              </span>
                              <span className={`w-2 h-2 rounded-full shrink-0 self-center ${status.dot}`} title={status.label} />
                              {(patient.opDate === today || patient.opDate === tomorrow) && (
                                <span
                                  className="shrink-0 self-center"
                                  title={`${patient.opDate === today ? '今日' : '明日'}手術：${patient.opProcedure || '術式未填'}`}
                                >
                                  {/* 今天實心深色、明天淡色虛化 — 同一個符號，一眼分得出急迫度 */}
                                  <Scissors className={`w-3.5 h-3.5 ${patient.opDate === today ? 'text-clay-600' : 'text-clay-400 opacity-70'}`} />
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-natural-200 group-hover:text-sage-400 ml-auto shrink-0 transition-colors self-center" />
                            </div>
                            <p className="text-xs text-natural-400 truncate mt-1">{patient.diagnosis || '—'}</p>
                          </button>
                          {/* Expand toggle */}
                          {!isEditMode && (
                            <button
                              onClick={() => toggleExpand(patient.id)}
                              className="shrink-0 p-1 text-natural-300 hover:text-natural-600 transition-colors"
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>

                        {/* Expanded summary */}
                        <AnimatePresence>
                          {isExpanded && !isEditMode && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 sm:px-6 pb-3 pt-1 pl-3 sm:pl-[88px] flex flex-wrap gap-x-4 gap-y-1 text-xs text-natural-500 bg-natural-50/60">
                                {(patient.medications?.length ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sage-400 shrink-0" />
                                    {patient.medications.slice(0, 3).map(m => m.name).join(' · ')}
                                    {patient.medications.length > 3 && ` +${patient.medications.length - 3}`}
                                  </span>
                                )}
                                {abnormals.length > 0 && (
                                  <span className="flex items-center gap-1.5 text-terracotta-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-terracotta-400 shrink-0" />
                                    {abnormals.length} abnormal
                                  </span>
                                )}
                                {lastCheck && (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-clay-400 shrink-0" />
                                    {format(new Date(lastCheck.date), 'MM/dd')} · T {lastCheck.fever}°C
                                  </span>
                                )}
                                {!patient.medications?.length && !patient.labTests?.length && !patient.dailyChecks?.length && (
                                  <span className="text-natural-300 italic">無詳細資料</span>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
                      <span className="text-[9px] font-bold text-sage-600 bg-sage-50 border border-sage-100 px-1.5 py-0.5 rounded uppercase tracking-wider w-12 text-center shrink-0">
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
