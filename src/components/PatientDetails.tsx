import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Activity, 
  ClipboardList, 
  FileText, 
  Plus, 
  Calendar,
  AlertCircle,
  Thermometer,
  CloudLightning,
  Droplets,
  Wind,
  Trash2,
  RefreshCw,
  Pencil,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, ENTChecklist, Gender } from '../types';
import DailyChecklistForm from './DailyChecklistForm';
import { format } from 'date-fns';
import { generateClinicalPearls } from '../services/geminiService';

interface PatientDetailsProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete: (id: string) => void;
}

export default function PatientDetails({ patient, onUpdate, onDelete }: PatientDetailsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'checklist'>('profile');
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [isGeneratingPearls, setIsGeneratingPearls] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-centering the timeline
  useEffect(() => {
    if (timelineRef.current) {
      const activeElement = timelineRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentCheckIndex, activeTab]);

  // Local state to handle smooth typing (IME)
  const [localFields, setLocalFields] = useState({
    name: patient.name,
    bedNumber: patient.bedNumber,
    chartNumber: patient.chartNumber,
    age: patient.age.toString(),
    admissionDate: patient.admissionDate,
    admissionDiagnosis: patient.admissionDiagnosis,
    preliminaryDiagnosis: patient.preliminaryDiagnosis,
    treatmentPlan: patient.treatmentPlan,
  });

  // Sync local fields when patient prop changes (e.g. selecting different patient)
  React.useEffect(() => {
    setLocalFields({
      name: patient.name,
      bedNumber: patient.bedNumber,
      chartNumber: patient.chartNumber,
      age: patient.age.toString(),
      admissionDate: patient.admissionDate,
      admissionDiagnosis: patient.admissionDiagnosis,
      preliminaryDiagnosis: patient.preliminaryDiagnosis,
      treatmentPlan: patient.treatmentPlan,
    });
  }, [patient.id, patient.name, patient.bedNumber, patient.chartNumber, patient.age, patient.admissionDate, patient.admissionDiagnosis, patient.preliminaryDiagnosis, patient.treatmentPlan]);

  const handleLocalChange = (field: keyof typeof localFields, value: string) => {
    setLocalFields(prev => ({ ...prev, [field]: value }));
  };

  const syncField = (field: keyof Patient, value: any) => {
    if (patient[field] === value) return;
    onUpdate({ ...patient, [field]: value });
  };

  const handleAddCheck = (newCheck: ENTChecklist) => {
    onUpdate({
      ...patient,
      dailyChecks: [newCheck, ...patient.dailyChecks]
    });
    setShowChecklistForm(false);
    setCurrentCheckIndex(0);
  };

  const handleUpdateCheck = (updatedCheck: ENTChecklist) => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => c.id === updatedCheck.id ? updatedCheck : c)
    });
    setEditingCheckId(null);
  };

  const handleToggleNoteCompletion = (checkId: string, noteIndex: number) => {
    onUpdate({
      ...patient,
      dailyChecks: patient.dailyChecks.map(c => {
        if (c.id !== checkId) return c;
        const notesArray = Array.isArray(c.notes) ? c.notes : (typeof c.notes === 'string' ? [{ text: c.notes, completed: false }] : []);
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
        const notesArray = Array.isArray(c.notes) ? c.notes : (typeof c.notes === 'string' ? [{ text: c.notes, completed: false }] : []);
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
        const notesArray = Array.isArray(c.notes) ? c.notes : (typeof c.notes === 'string' ? [{ text: c.notes, completed: false }] : []);
        const newNotes = notesArray.map((n, i) => 
          i === index ? (typeof n === 'string' ? { text, completed: false } : { ...n, text }) : n
        );
        return { ...c, notes: newNotes };
      })
    });
  };

  const handleRefreshPearls = async () => {
    setIsGeneratingPearls(true);
    try {
      const pearls = await generateClinicalPearls(patient);
      onUpdate({ ...patient, clinicalPearls: pearls });
    } catch (error) {
      console.error("Refresh pearls error:", error);
    } finally {
      setIsGeneratingPearls(false);
    }
  };

  const currentSummary = patient.dailyChecks[0];

  return (
    <div className="space-y-6 text-natural-600">
      {/* Patient Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-natural-200 shadow-sm flex flex-col md:flex-row gap-6 items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-natural-100 -mr-16 -mt-16 rounded-full opacity-30 pointer-events-none" />
        
        <div className="relative flex-1 flex flex-wrap gap-x-8 gap-y-4 items-center">
          {/* Main Identity Info */}
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-2 items-center">
              <input 
                value={localFields.bedNumber}
                onChange={(e) => handleLocalChange('bedNumber', e.target.value)}
                onBlur={() => syncField('bedNumber', localFields.bedNumber)}
                className="px-2 py-0.5 rounded bg-sage-50 text-sage-600 border border-sage-100 text-[10px] font-bold uppercase tracking-wider focus:ring-1 focus:ring-sage-500 focus:outline-hidden [field-sizing:content] min-w-[30px]"
              />
              <span className="text-[9px] font-bold text-natural-300 uppercase tracking-widest">Bed No.</span>
            </div>
            <input 
              value={localFields.name}
              onChange={(e) => handleLocalChange('name', e.target.value)}
              onBlur={() => syncField('name', localFields.name)}
              placeholder="Patient Name"
              className="text-2xl font-serif font-bold text-natural-900 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden [field-sizing:content] min-w-[120px] max-w-full"
            />
          </div>

          {/* Secondary Info Blocks */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center border-l border-natural-100 pl-6">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-natural-300 uppercase tracking-widest">Chart No.</span>
              <input 
                value={localFields.chartNumber}
                onChange={(e) => handleLocalChange('chartNumber', e.target.value)}
                onBlur={() => syncField('chartNumber', localFields.chartNumber)}
                className="text-xs font-bold text-natural-600 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden [field-sizing:content] min-w-[50px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-natural-300 uppercase tracking-widest">Status</span>
              <select 
                value={patient.status}
                onChange={(e) => syncField('status', e.target.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border focus:outline-hidden transition-all w-auto ${
                  patient.status === 'Stable' 
                    ? 'bg-sage-50 text-sage-700 border-sage-100' 
                    : patient.status === 'Critical' 
                      ? 'bg-terracotta-50 text-terracotta-700 border-terracotta-100'
                      : 'bg-clinical-50 text-clinical-700 border-clinical-100'
                }`}
              >
                <option value="Stable">Stable</option>
                <option value="Critical">Critical</option>
                <option value="Discharge Pending">Discharge Pending</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-natural-300 uppercase tracking-widest">Demographics</span>
              <div className="flex gap-1.5 items-center">
                <input 
                  type="number"
                  value={localFields.age}
                  onChange={(e) => handleLocalChange('age', e.target.value)}
                  onBlur={() => syncField('age', parseInt(localFields.age) || 0)}
                  className="w-8 text-xs font-bold text-natural-600 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden"
                />
                <span className="text-natural-200 text-[10px]">y/o</span>
                <select 
                  value={patient.gender}
                  onChange={(e) => syncField('gender', e.target.value)}
                  className="text-xs font-bold text-natural-600 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden w-fit"
                >
                  <option value="Male">M</option>
                  <option value="Female">F</option>
                  <option value="Other">O</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-natural-300 uppercase tracking-widest">Adm. Date</span>
              <input 
                type="date"
                value={localFields.admissionDate}
                onChange={(e) => handleLocalChange('admissionDate', e.target.value)}
                onBlur={() => syncField('admissionDate', localFields.admissionDate)}
                className="text-xs font-bold text-natural-600 bg-transparent border-b border-transparent hover:border-natural-200 focus:border-sage-500 focus:outline-hidden w-auto"
              />
            </div>
          </div>
        </div>

        {/* Action / Vital Summary Area */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-natural-50 px-3 py-1.5 rounded-lg border border-natural-200 shadow-inner flex flex-col items-center min-w-[70px]">
            <span className="text-[9px] text-natural-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <Activity className="w-2 h-2" /> Temp
            </span>
            <p className="text-base font-serif font-bold text-natural-900 leading-tight">
              {currentSummary ? `${currentSummary.fever}°` : '--'}
            </p>
          </div>
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this patient profile? This action cannot be undone.')) {
                onDelete(patient.id);
              }
            }}
            className="p-2 text-natural-200 hover:text-terracotta-500 transition-colors"
            title="Delete Patient"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-natural-100 rounded-xl w-fit border border-natural-200">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${
            activeTab === 'profile' 
              ? 'bg-white text-sage-600 shadow-sm border border-natural-200' 
              : 'text-natural-400 hover:text-natural-600'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Clinical Info
        </button>
        <button 
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${
            activeTab === 'checklist' 
              ? 'bg-white text-sage-600 shadow-sm border border-natural-200' 
              : 'text-natural-400 hover:text-natural-600'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Daily Rounds
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-transparent">
        {activeTab === 'profile' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-4">
              <div className="bg-white rounded-2xl p-6 border border-natural-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1 px-1 flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> Admission Diagnosis
                    </h4>
                    <textarea 
                      value={localFields.admissionDiagnosis}
                      onChange={(e) => handleLocalChange('admissionDiagnosis', e.target.value)}
                      onBlur={() => syncField('admissionDiagnosis', localFields.admissionDiagnosis)}
                      className="w-full text-natural-900 bg-natural-50 p-3 rounded-lg border border-natural-100 italic font-serif text-sm leading-relaxed min-h-[60px] focus:ring-1 focus:ring-sage-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-1 px-1 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" /> Preliminary Diagnosis
                    </h4>
                    <textarea 
                      value={localFields.preliminaryDiagnosis}
                      onChange={(e) => handleLocalChange('preliminaryDiagnosis', e.target.value)}
                      onBlur={() => syncField('preliminaryDiagnosis', localFields.preliminaryDiagnosis)}
                      className="w-full text-natural-900 bg-natural-50 p-3 rounded-lg border border-natural-100 italic font-serif text-sm leading-relaxed min-h-[60px] focus:ring-1 focus:ring-sage-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-natural-200 shadow-sm">
                <h4 className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                  <ClipboardList className="w-2.5 h-2.5" /> Treatment Plan
                </h4>
                <textarea 
                  value={localFields.treatmentPlan}
                  onChange={(e) => handleLocalChange('treatmentPlan', e.target.value)}
                  onBlur={() => syncField('treatmentPlan', localFields.treatmentPlan)}
                  rows={4}
                  className="w-full bg-[#fdfbf7] p-4 rounded-lg border-l-4 border-sage-500 whitespace-pre-wrap leading-relaxed text-natural-800 text-xs font-medium italic focus:outline-hidden"
                />
              </div>
            </div>

            {/* Sidebar info */}
            <div className="md:col-span-4 space-y-6">
              <div className="bg-natural-600 rounded-2xl p-6 text-natural-100 shadow-lg relative overflow-hidden border border-natural-900">
                <div className="absolute -bottom-4 -right-4 p-4 opacity-10">
                  <AlertCircle className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between mb-4 border-b border-natural-500 pb-2">
                  <h4 className="text-sage-100 text-[10px] font-bold uppercase tracking-wider">Clinical Pearls / Warnings</h4>
                  <button 
                    onClick={handleRefreshPearls}
                    disabled={isGeneratingPearls}
                    className="p-1 hover:bg-natural-500 rounded transition-colors text-sage-100 disabled:opacity-50"
                    title="重新生成 AI 建議"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGeneratingPearls ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <ul className="space-y-4 text-xs font-medium">
                  {patient.clinicalPearls && patient.clinicalPearls.length > 0 ? (
                    patient.clinicalPearls.map((pearl, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          idx % 4 === 0 ? 'bg-terracotta-500' :
                          idx % 4 === 1 ? 'bg-sage-500' :
                          idx % 4 === 2 ? 'bg-clinical-500' : 'bg-clay-500'
                        }`} />
                        {pearl}
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-terracotta-500 mt-1.5 shrink-0" />
                        Monitor for neck hematoma / Bleeding
                      </li>
                      <li className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-sage-500 mt-1.5 shrink-0" />
                        Assess for airway stridor
                      </li>
                      <li className="flex gap-3 flex-col">
                        <button 
                          onClick={handleRefreshPearls}
                          className="mt-2 text-[10px] bg-natural-500/50 hover:bg-natural-500 py-1 px-2 rounded text-center transition-all border border-natural-400"
                        >
                          {isGeneratingPearls ? 'Generating...' : 'Click to generate AI insights'}
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-serif font-bold text-natural-900">Daily Ward Rounds</h3>
                <p className="text-xs text-natural-400 font-medium">Recorded clinical evaluations</p>
              </div>
              <button 
                onClick={() => setShowChecklistForm(true)}
                className="flex items-center gap-2 bg-sage-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-sage-600 transition-all border border-sage-600"
              >
                <Plus className="w-4 h-4" />
                Add New Record
              </button>
            </div>

            {showChecklistForm && !editingCheckId && (
              <DailyChecklistForm onCancel={() => setShowChecklistForm(false)} onSubmit={handleAddCheck} />
            )}

            <div className="flex flex-col gap-6 text-natural-600">
              {patient.dailyChecks.length === 0 ? (
                <div className="bg-white rounded-2xl py-16 text-center border-2 border-dashed border-natural-200">
                  <ClipboardList className="w-12 h-12 text-natural-200 mx-auto mb-4" />
                  <p className="text-natural-400 font-bold uppercase tracking-widest text-xs">No records found</p>
                </div>
              ) : (
                <>
                  {/* Date Timeline */}
                  <div className="relative">
                    <div 
                      ref={timelineRef}
                      className="bg-white rounded-2xl p-6 border border-natural-200 shadow-sm overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                      style={{ 
                        maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
                      }}
                    >
                      <div className="flex items-center gap-6 px-[40%] min-w-max">
                        {[...patient.dailyChecks].reverse().map((check, revIdx) => {
                          const originalIdx = (patient.dailyChecks.length - 1) - revIdx;
                          const isActive = currentCheckIndex === originalIdx;
                          return (
                            <motion.button
                              key={check.id}
                              data-active={isActive}
                              disabled={editingCheckId !== null}
                              onClick={() => setCurrentCheckIndex(originalIdx)}
                              initial={false}
                              animate={{ 
                                scale: isActive ? 1.1 : 0.9,
                                opacity: isActive ? 1 : 0.4
                              }}
                              className={`snap-center relative flex flex-col items-center p-4 rounded-2xl transition-all min-w-[90px] ${
                                isActive 
                                  ? 'bg-sage-600 text-white shadow-lg ring-4 ring-sage-50' 
                                  : 'bg-natural-50 text-natural-400 border border-natural-200'
                              }`}
                            >
                              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isActive ? 'text-sage-100' : 'text-natural-400'}`}>
                                {format(new Date(check.date), 'EEE')}
                              </span>
                              <span className="text-xl font-serif font-bold">
                                {format(new Date(check.date), 'dd')}
                              </span>
                              <span className={`text-[9px] font-bold mt-1 ${isActive ? 'text-sage-200' : 'text-natural-300'}`}>
                                {format(new Date(check.date), 'MMM')}
                              </span>
                              
                              {isActive && (
                                <motion.div 
                                  layoutId="active-date-glow"
                                  className="absolute inset-0 bg-sage-400 rounded-2xl -z-10 blur-md opacity-20"
                                />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Floating active indicator */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-sage-200 pointer-events-none opacity-20" />
                  </div>

                  {/* Carousel Content */}
                  <div className="relative group">
                    {/* Navigation Arrows */}
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setCurrentCheckIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentCheckIndex === 0 || editingCheckId !== null}
                        className="bg-white p-3 rounded-full shadow-lg border border-natural-200 text-natural-400 hover:text-sage-600 disabled:opacity-0 transition-all"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setCurrentCheckIndex(prev => Math.min(patient.dailyChecks.length - 1, prev + 1))}
                        disabled={currentCheckIndex === patient.dailyChecks.length - 1 || editingCheckId !== null}
                        className="bg-white p-3 rounded-full shadow-lg border border-natural-200 text-natural-400 hover:text-sage-600 disabled:opacity-0 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={patient.dailyChecks[currentCheckIndex].id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        drag={editingCheckId === null ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                          if (editingCheckId !== null) return;
                          if (info.offset.x > 100 && currentCheckIndex > 0) {
                            setCurrentCheckIndex(prev => prev - 1);
                          } else if (info.offset.x < -100 && currentCheckIndex < patient.dailyChecks.length - 1) {
                            setCurrentCheckIndex(prev => prev + 1);
                          }
                        }}
                      >
                        {(() => {
                          const check = patient.dailyChecks[currentCheckIndex];
                          return (
                            <div className="bg-white rounded-2xl p-8 border border-natural-200 shadow-sm flex flex-col lg:flex-row gap-8 relative group">
                              <div className="shrink-0 flex flex-col items-center justify-center p-4 bg-natural-50 rounded-xl border border-natural-200 min-w-[140px] shadow-inner font-bold">
                                <Calendar className="w-4 h-4 text-natural-400 mb-2" />
                                <span className="text-lg font-serif text-natural-900">{format(new Date(check.date), 'MMM dd')}</span>
                                <span className="text-[10px] text-natural-400 uppercase tracking-widest">{format(new Date(check.date), 'HH:mm')}</span>
                                <button 
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this daily ward round record?')) {
                                      const newChecks = patient.dailyChecks.filter(c => c.id !== check.id);
                                      onUpdate({
                                        ...patient,
                                        dailyChecks: newChecks
                                      });
                                      // Adjust index if we deleted the last item
                                      if (currentCheckIndex >= newChecks.length) {
                                        setCurrentCheckIndex(Math.max(0, newChecks.length - 1));
                                      }
                                    }
                                  }}
                                  className="mt-4 p-1.5 text-natural-300 hover:text-terracotta-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                 <Metric 
                                   label="Bleeding" 
                                   value={check.bleeding} 
                                   type="select"
                                   options={['None', 'Minimal', 'Moderate', 'Severe']}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'bleeding', val)}
                                   theme="sage" 
                                   icon={<Droplets className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Airway" 
                                   value={check.airway} 
                                   type="select"
                                   options={['Patent', 'Stridor', 'Distress']}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'airway', val)}
                                   theme="clinical" 
                                   icon={<Wind className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Swallow" 
                                   value={check.swallowing} 
                                   type="select"
                                   options={['Normal', 'Dysphagia', 'Aspiration']}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'swallowing', val)}
                                   theme="clay" 
                                   icon={<Activity className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="CN VII" 
                                   value={check.facialNerve} 
                                   type="select"
                                   options={['Normal', 'Paresis', 'Paralysis']}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'facialNerve', val)}
                                   theme="natural" 
                                   icon={<User className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Hoarse" 
                                   value={check.hoarseness ? 'Yes' : 'No'} 
                                   type="select"
                                   options={['Yes', 'No']}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'hoarseness', val === 'Yes')}
                                   theme={check.hoarseness ? 'terracotta' : 'sage'} 
                                   icon={<Activity className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Drain" 
                                   value={check.drainAmount.toString()} 
                                   suffix="cc"
                                   type="number"
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'drainAmount', parseInt(val) || 0)}
                                   theme="clay" 
                                   icon={<Droplets className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Temp" 
                                   value={check.fever.toString()} 
                                   suffix="°C"
                                   type="number"
                                   step={0.1}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'fever', parseFloat(val) || 0)}
                                   theme={check.fever > 38 ? 'terracotta' : 'sage'} 
                                   icon={<Thermometer className="w-3.5 h-3.5" />} 
                                 />
                                 <Metric 
                                   label="Pain" 
                                   value={check.painLevel.toString()} 
                                   suffix="/10"
                                   type="number"
                                   min={0}
                                   max={10}
                                   onChange={(val) => handleCheckFieldUpdate(check.id, 'painLevel', parseInt(val) || 0)}
                                   theme="terracotta" 
                                   icon={<CloudLightning className="w-3.5 h-3.5" />} 
                                 />
                              </div>

                              <div className="flex-1 shrink-0 pt-6 lg:pt-0 lg:pl-8 lg:border-l border-natural-100 max-w-md">
                                <div className="flex justify-between items-center mb-3">
                                  <p className="text-[10px] font-bold text-natural-400 uppercase tracking-widest">Rounding Checklist</p>
                                  <button 
                                    onClick={() => {
                                      const notesArray = Array.isArray(check.notes) ? check.notes : (typeof check.notes === 'string' ? [{ text: check.notes, completed: false }] : []);
                                      handleCheckFieldUpdate(check.id, 'notes', [...notesArray, { text: '', completed: false }]);
                                    }}
                                    className="p-1 text-sage-500 hover:bg-sage-50 rounded transition-all"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <ul className="space-y-2">
                                  {(Array.isArray(check.notes) ? check.notes : (typeof check.notes === 'string' ? [{ text: check.notes, completed: false }] : [])).map((noteRaw, idx) => {
                                    const note = typeof noteRaw === 'string' ? { text: noteRaw, completed: false } : noteRaw;
                                    return (
                                      <li 
                                        key={idx} 
                                        className={`flex gap-2 items-start group/item transition-all ${
                                          note.completed ? 'opacity-40' : 'opacity-100'
                                        }`}
                                      >
                                        <div className="flex flex-col gap-0 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveNote(check.id, idx, 'up'); }}
                                            disabled={idx === 0}
                                            className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-0 text-natural-400 hover:text-sage-600"
                                          >
                                            <ChevronUp className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleMoveNote(check.id, idx, 'down'); }}
                                            disabled={idx === check.notes.length - 1}
                                            className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-0 text-natural-400 hover:text-sage-600"
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                        </div>

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
                                            onChange={(e) => handleUpdateNoteText(check.id, idx, e.target.value)}
                                            className={`w-full bg-transparent text-sm font-medium leading-tight focus:outline-hidden border-b border-transparent hover:border-natural-100 focus:border-sage-400 ${
                                              note.completed ? 'line-through text-natural-400' : 'text-natural-900 italic'
                                            }`}
                                          />
                                        </div>

                                        <button 
                                          onClick={() => {
                                            const notesArray = Array.isArray(check.notes) ? check.notes : (typeof check.notes === 'string' ? [{ text: check.notes, completed: false }] : []);
                                            handleCheckFieldUpdate(check.id, 'notes', notesArray.filter((_, i) => i !== idx));
                                          }}
                                          className="opacity-0 group-hover/item:opacity-100 p-1 text-natural-300 hover:text-terracotta-500 transition-all shrink-0"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ 
  label, 
  value, 
  theme, 
  icon, 
  type = 'text', 
  options = [], 
  onChange, 
  suffix = '',
  min,
  max,
  step
}: { 
  label: string, 
  value: string, 
  theme: string, 
  icon: React.ReactNode,
  type?: 'text' | 'number' | 'select',
  options?: string[],
  onChange?: (val: string) => void,
  suffix?: string,
  min?: number,
  max?: number,
  step?: number
}) {
  const themeMap: Record<string, string> = {
    sage: 'bg-sage-50 text-sage-700 border-sage-100',
    terracotta: 'bg-terracotta-50 text-terracotta-600 border-terracotta-100',
    clay: 'bg-clay-50 text-clay-700 border-clay-100',
    clinical: 'bg-clinical-50 text-clinical-600 border-clinical-100',
    natural: 'bg-natural-50 text-natural-600 border-natural-200',
  };

  return (
    <div className={`p-3 rounded-xl border flex flex-col gap-1 shadow-xs transition-all ${themeMap[theme] || themeMap.natural} hover:shadow-sm`}>
      <div className="flex items-center gap-1.5 opacity-60">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-1 mt-1">
        {type === 'select' ? (
          <select 
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full bg-transparent text-xs font-bold focus:outline-hidden cursor-pointer"
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : type === 'number' ? (
          <div className="flex items-baseline w-full">
            <input 
              type="number"
              value={value}
              min={min}
              max={max}
              step={step}
              onChange={(e) => onChange?.(e.target.value)}
              className="w-full bg-transparent text-xs font-bold focus:outline-hidden"
            />
            {suffix && <span className="text-[10px] opacity-60">{suffix}</span>}
          </div>
        ) : (
          <span className="text-xs font-bold truncate leading-none">{value}</span>
        )}
      </div>
    </div>
  );
}
