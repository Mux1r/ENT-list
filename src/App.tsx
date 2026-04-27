import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Settings, 
  LogOut, 
  Ear, 
  Activity, 
  ClipboardList, 
  ChevronRight,
  ChevronLeft,
  Filter,
  Stethoscope,
  FileUp,
  LogIn,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, ENTChecklist } from './types';
import PatientDetails from './components/PatientDetails';
import PatientForm from './components/PatientForm';
import ImportModal from './components/ImportModal';
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
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format } from 'date-fns';

// Mock Initial Data
const MOCK_PATIENTS: Patient[] = [
  {
    id: '1',
    name: '王大明',
    bedNumber: '7A-01',
    age: 55,
    gender: 'Male',
    chartNumber: '1234567',
    admissionDate: '2026-04-20',
    admissionDiagnosis: 'Left Vocal Fold Polyp',
    preliminaryDiagnosis: 'Left Vocal Fold Polyp, suspected malignancy R/O',
    treatmentPlan: '1. Micro-laryngeal surgery (MLS)\n2. Post-op voice rest\n3. Speech therapy referral',
    status: 'Stable',
    dailyChecks: [
      {
        id: 'c1',
        date: '2026-04-21T08:00:00Z',
        bleeding: 'None',
        airway: 'Clear',
        swallowing: 'Normal',
        facialNerve: 'Intact',
        hoarseness: true,
        drainAmount: 0,
        woundStatus: 'Clean',
        painLevel: 2,
        fever: 36.8,
        notes: [{ text: 'MLS post-op Day 1. Voice rest strictly followed.', completed: false }]
      }
    ]
  },
  {
    id: '2',
    name: '李小美',
    bedNumber: '7B-12',
    age: 32,
    gender: 'Female',
    chartNumber: '7654321',
    admissionDate: '2026-04-25',
    admissionDiagnosis: 'Chronic Rhinosinusitis with Nasal Polyps',
    preliminaryDiagnosis: 'Chronic Rhinosinusitis with Nasal Polyps, Bilateral',
    treatmentPlan: '1. Functional Endoscopic Sinus Surgery (FESS)\n2. Nasal packing for 48 hours\n3. Post-op nasal irrigation',
    status: 'Stable',
    dailyChecks: []
  }
];

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
          data.dailyChecks.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        patientData.push({ ...data, id: doc.id } as Patient);
      });
      setPatients(patientData);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const filteredPatients = patients.filter(p => 
    p.name.includes(searchTerm) || 
    p.bedNumber.includes(searchTerm) || 
    p.chartNumber.includes(searchTerm)
  );

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    if (!user) return;
    try {
      const patientRef = doc(db, 'patients', updatedPatient.id);
      
      // 關鍵修復：僅擷取允許更新的欄位，避免傳送 id, ownerId, createdAt 等不可變欄位
      const { 
        name, bedNumber, age, gender, chartNumber, 
        admissionDate, admissionDiagnosis, preliminaryDiagnosis, 
        treatmentPlan, status, dailyChecks, clinicalPearls
      } = updatedPatient;

      await updateDoc(patientRef, {
        name,
        bedNumber,
        age,
        gender,
        chartNumber,
        admissionDate,
        admissionDiagnosis,
        preliminaryDiagnosis,
        treatmentPlan,
        status,
        dailyChecks,
        clinicalPearls: clinicalPearls || [],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating patient:", error);
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

  const handleAddPatient = async (newPatientData: Omit<Patient, 'id'>) => {
    if (!user) return;
    try {
      const patientsRef = collection(db, 'patients');
      const newDocRef = doc(patientsRef);
      const newPatientWithId = {
        ...newPatientData,
        id: newDocRef.id,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(newDocRef, newPatientWithId);
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding patient:", error);
    }
  };

  const handleBatchImport = async (importedPatients: Patient[]) => {
    if (!user) return;
    try {
      for (const patient of importedPatients) {
        const patientsRef = collection(db, 'patients');
        const newDocRef = doc(patientsRef);
        await setDoc(newDocRef, {
          ...patient,
          id: newDocRef.id,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setShowImportModal(false);
      alert(`成功匯入 ${importedPatients.length} 位病患資料`);
    } catch (error) {
      console.error("Error batch importing:", error);
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
    <div className="flex h-screen bg-natural-50 overflow-hidden font-sans text-natural-600">
      {/* Sidebar */}
      <motion.nav 
        id="sidebar" 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-natural-100 border-r border-natural-200 flex flex-col shrink-0 relative"
      >
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 bg-white border border-natural-200 rounded-full p-1 shadow-sm text-natural-400 hover:text-sage-600 z-50 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={`p-6 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="p-2 bg-sage-500 rounded-lg shadow-sm shrink-0">
            <Ear className="w-6 h-6 text-white" />
          </div>
          {!isSidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-xl font-serif font-bold text-natural-900 tracking-tight leading-none">ENT 住院</h1>
              <p className="text-[10px] uppercase tracking-widest text-natural-400 font-bold mt-1">Rounding System</p>
            </motion.div>
          )}
        </div>

        <div className="flex-1 px-4 space-y-1.5 mt-4">
          <button 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
              !selectedPatientId ? 'bg-sage-100 text-sage-700 shadow-xs' : 'text-natural-400 hover:bg-white hover:text-natural-600'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            onClick={() => setSelectedPatientId(null)}
            title={isSidebarCollapsed ? "病患列表" : undefined}
          >
            <Users className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>病患列表</span>}
          </button>
          <button 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-natural-400 hover:bg-white hover:text-natural-600 transition-all font-bold text-sm ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={isSidebarCollapsed ? "今日排程" : undefined}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>今日排程</span>}
          </button>
          <button 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-natural-400 hover:bg-white hover:text-natural-600 transition-all font-bold text-sm ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={isSidebarCollapsed ? "臨床指引" : undefined}
          >
            <Stethoscope className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>臨床指引</span>}
          </button>
        </div>

        <div className="p-4 mt-auto border-t border-natural-200">
          <div className={`flex items-center gap-3 p-3 bg-white rounded-xl border border-natural-200 ${isSidebarCollapsed ? 'justify-center p-2' : ''}`}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-natural-100 shrink-0 object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center font-bold text-sage-700 text-xs text-uppercase shrink-0">
                {user.displayName?.charAt(0) || 'D'}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex-1 truncate">
                <p className="text-xs font-bold text-natural-900 truncate">{user.displayName || 'Doctor'}</p>
                <p className="text-[10px] text-natural-400 uppercase truncate">ENT Specialist</p>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 mt-4 text-natural-400 hover:text-terracotta-500 text-xs font-bold transition-colors ${isSidebarCollapsed ? 'p-2' : ''}`}
            title={isSidebarCollapsed ? "登出系統" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span>登出系統</span>}
          </button>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-natural-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-natural-300" />
              <input 
                type="text" 
                placeholder="搜尋病患姓名, 床號或病歷號..." 
                className="w-full pl-10 pr-4 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all outline-hidden"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-natural-100 text-natural-600 px-4 py-2 rounded-lg text-sm font-bold border border-natural-200 hover:bg-natural-200 transition-all shadow-xs"
            >
              <FileUp className="w-4 h-4" />
              資料匯入
            </button>
            <button 
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-sage-500 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-sage-600 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              新增病患
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

        <div className="flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            {!selectedPatientId ? (
              <motion.div 
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredPatients.map(patient => (
                  <button 
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className="group text-left bg-white p-6 rounded-2xl border border-natural-200 shadow-sm hover:shadow-md hover:border-sage-500 transition-all flex flex-col gap-4 relative overflow-hidden"
                  >
                    <div className="relative flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-md bg-sage-50 text-sage-600 text-[10px] font-bold uppercase tracking-wider mb-2 inline-block border border-sage-100">
                          Bed {patient.bedNumber}
                        </span>
                        <h3 className="text-xl font-serif font-bold text-natural-900 group-hover:text-sage-600 transition-colors">{patient.name}</h3>
                        <p className="text-xs text-natural-400 font-medium">{patient.gender === 'Male' ? '男' : '女'} · {patient.age} 歲 · {patient.chartNumber}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-natural-200 group-hover:text-sage-500 transition-colors" />
                    </div>

                    <div className="relative pt-4 border-t border-natural-100 flex flex-col gap-3">
                       <div className="flex items-start gap-2">
                         <Activity className="w-3.5 h-3.5 text-sage-500 mt-0.5 shrink-0" />
                         <span className="text-xs font-serif italic text-natural-600 line-clamp-1">{patient.admissionDiagnosis}</span>
                       </div>
                       <div className="flex items-center gap-2 text-natural-400 text-[10px] uppercase font-bold tracking-tight">
                         <ClipboardList className="w-3.5 h-3.5" />
                         <span>Last Round: {patient.dailyChecks.length > 0 ? patient.dailyChecks[patient.dailyChecks.length - 1].date.split('T')[0] : 'None'}</span>
                       </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : selectedPatient ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-6xl mx-auto"
              >
                <div className="mb-6">
                  <button 
                    onClick={() => setSelectedPatientId(null)}
                    className="text-xs font-bold uppercase tracking-widest text-natural-400 hover:text-sage-600 flex items-center gap-1 mb-4 group transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Back to Patient List
                  </button>
                </div>
                <PatientDetails 
                  patient={selectedPatient} 
                  onUpdate={handleUpdatePatient}
                  onDelete={handleDeletePatient}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
