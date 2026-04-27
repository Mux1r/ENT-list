import React, { useState } from 'react';
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
  Filter,
  Stethoscope,
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, ENTChecklist } from './types';
import PatientDetails from './components/PatientDetails';
import PatientForm from './components/PatientForm';
import ImportModal from './components/ImportModal';
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
        notes: 'MLS post-op Day 1. Voice rest strictly followed.'
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
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const filteredPatients = patients.filter(p => 
    p.name.includes(searchTerm) || 
    p.bedNumber.includes(searchTerm) || 
    p.chartNumber.includes(searchTerm)
  );

  const handleUpdatePatient = (updatedPatient: Patient) => {
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
  };

  const handleAddPatient = (newPatient: Patient) => {
    setPatients(prev => [newPatient, ...prev]);
    setShowAddForm(false);
  };

  const handleBatchImport = (importedPatients: Patient[]) => {
    setPatients(prev => [...importedPatients, ...prev]);
    setShowImportModal(false);
    alert(`成功匯入 ${importedPatients.length} 位病患資料`);
  };

  return (
    <div className="flex h-screen bg-natural-50 overflow-hidden font-sans text-natural-600">
      {/* Sidebar */}
      <nav id="sidebar" className="w-64 bg-natural-100 border-r border-natural-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="p-2 bg-sage-500 rounded-lg shadow-sm">
            <Ear className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-natural-900 tracking-tight leading-none">ENT 住院</h1>
            <p className="text-[10px] uppercase tracking-widest text-natural-400 font-bold mt-1">Rounding System</p>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1.5 mt-4">
          <button 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
              !selectedPatientId ? 'bg-sage-100 text-sage-700 shadow-xs' : 'text-natural-400 hover:bg-white hover:text-natural-600'
            }`}
            onClick={() => setSelectedPatientId(null)}
          >
            <Users className="w-4 h-4" />
            <span>病患列表</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-natural-400 hover:bg-white hover:text-natural-600 transition-all font-bold text-sm">
            <ClipboardList className="w-4 h-4" />
            <span>今日排程</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-natural-400 hover:bg-white hover:text-natural-600 transition-all font-bold text-sm">
            <Stethoscope className="w-4 h-4" />
            <span>臨床指引</span>
          </button>
        </div>

        <div className="p-4 mt-auto border-t border-natural-200">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-natural-200">
            <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center font-bold text-sage-700 text-xs">
              ENT
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-bold text-natural-900">Dr. Lin</p>
              <p className="text-[10px] text-natural-400 uppercase">Attending Physician</p>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 mt-4 text-natural-400 hover:text-terracotta-500 text-xs font-bold transition-colors">
            <LogOut className="w-4 h-4" />
            登出系統
          </button>
        </div>
      </nav>

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
                         <span>Last Round: {patient.dailyChecks.length > 0 ? patient.dailyChecks[0].date.split('T')[0] : 'None'}</span>
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
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
