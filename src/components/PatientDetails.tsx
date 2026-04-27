import React, { useState } from 'react';
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
  FileEdit
} from 'lucide-react';
import { motion } from 'motion/react';
import { Patient, ENTChecklist } from '../types';
import DailyChecklistForm from './DailyChecklistForm';
import PatientForm from './PatientForm';
import { format } from 'date-fns';

interface PatientDetailsProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
}

export default function PatientDetails({ patient, onUpdate }: PatientDetailsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'checklist'>('profile');
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleAddCheck = (newCheck: ENTChecklist) => {
    onUpdate({
      ...patient,
      dailyChecks: [newCheck, ...patient.dailyChecks]
    });
    setShowChecklistForm(false);
  };

  const currentSummary = patient.dailyChecks[0];

  return (
    <div className="space-y-6 text-natural-600">
      {/* Patient Edit Form Overlay */}
      {showEditForm && (
        <PatientForm 
          patient={patient}
          onSubmit={(updated) => {
            onUpdate(updated);
            setShowEditForm(false);
          }}
          onCancel={() => setShowEditForm(false)}
        />
      )}

      {/* Patient Header Card */}
      <div className="bg-white rounded-2xl p-8 border border-natural-200 shadow-sm flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-natural-100 -mr-16 -mt-16 rounded-full opacity-50" />
        
        <div className="relative w-20 h-20 rounded-xl bg-natural-100 border border-natural-200 flex items-center justify-center shrink-0">
          <User className="w-10 h-10 text-natural-400" />
        </div>

        <div className="relative flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="flex gap-4 items-center mb-2">
              <span className="px-3 py-1 rounded-md bg-sage-50 text-sage-600 border border-sage-100 text-xs font-bold uppercase tracking-wider">
                Bed {patient.bedNumber}
              </span>
              <h2 className="text-3xl font-serif font-bold text-natural-900">{patient.name}</h2>
              <button 
                onClick={() => setShowEditForm(true)}
                className="p-1.5 text-natural-300 hover:text-sage-500 transition-colors"
                title="編輯資料 Edit"
              >
                <FileEdit className="w-4 h-4" />
              </button>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                patient.status === 'Stable' 
                  ? 'bg-sage-50 text-sage-700 border-sage-100' 
                  : 'bg-terracotta-50 text-terracotta-500 border-terracotta-100'
              }`}>
                {patient.status}
              </span>
            </div>
            <div className="flex gap-4 text-natural-400 text-xs font-medium">
              <span>Chart No: {patient.chartNumber}</span>
              <span>·</span>
              <span>{patient.gender === 'Male' ? 'Male' : 'Female'} · {patient.age}Y</span>
              <span>·</span>
              <span>Admitted: {patient.admissionDate}</span>
            </div>
          </div>
          
          <div className="bg-natural-50 rounded-xl p-4 border border-natural-200 shadow-inner">
            <p className="text-[10px] text-natural-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Recent Vitals
            </p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-serif font-bold text-natural-900">
                  {currentSummary ? `${currentSummary.fever}°C` : '--'}
                </p>
                <p className="text-[10px] text-natural-400 font-bold uppercase">Temp</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-serif font-bold text-natural-900">
                  {currentSummary ? `${currentSummary.painLevel}/10` : '--'}
                </p>
                <p className="text-[10px] text-natural-400 font-bold uppercase">Pain</p>
              </div>
            </div>
          </div>
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
            <div className="md:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-natural-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6 border-b border-natural-100 pb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-sage-600">Diagnosis Overview</h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">Admission Diagnosis</h4>
                    <p className="text-natural-900 bg-natural-50 p-4 rounded-xl border border-natural-200 italic font-serif leading-relaxed">
                      {patient.admissionDiagnosis}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">Preliminary Diagnosis</h4>
                    <p className="text-natural-900 bg-natural-50 p-4 rounded-xl border border-natural-200 italic font-serif leading-relaxed">
                      {patient.preliminaryDiagnosis}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-natural-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6 border-b border-natural-100 pb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-sage-600">Treatment Plan</h3>
                </div>
                <div className="bg-[#fdfbf7] p-6 rounded-xl border-l-4 border-sage-500 whitespace-pre-wrap leading-loose text-natural-800 text-sm font-medium italic">
                  {patient.treatmentPlan}
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="md:col-span-4 space-y-6">
              <div className="bg-natural-600 rounded-2xl p-6 text-natural-100 shadow-lg relative overflow-hidden border border-natural-900">
                <div className="absolute -bottom-4 -right-4 p-4 opacity-10">
                  <AlertCircle className="w-32 h-32" />
                </div>
                <h4 className="text-sage-100 text-[10px] font-bold uppercase tracking-wider mb-4 border-b border-natural-500 pb-2">Clinical Pearls / Warnings</h4>
                <ul className="space-y-4 text-xs font-medium">
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-terracotta-500 mt-1.5 shrink-0" />
                    Monitor for neck hematoma / Bleeding
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-sage-500 mt-1.5 shrink-0" />
                    Assess for airway stridor
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-clinical-500 mt-1.5 shrink-0" />
                    Evaluate CN XII - tongue deviation
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-clay-500 mt-1.5 shrink-0" />
                    Voice quality assessment (Recurrent LN)
                  </li>
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

            {showChecklistForm && (
              <DailyChecklistForm onCancel={() => setShowChecklistForm(false)} onSubmit={handleAddCheck} />
            )}

            <div className="grid grid-cols-1 gap-6">
              {patient.dailyChecks.length === 0 ? (
                <div className="bg-white rounded-2xl py-16 text-center border-2 border-dashed border-natural-200">
                  <ClipboardList className="w-12 h-12 text-natural-200 mx-auto mb-4" />
                  <p className="text-natural-400 font-bold uppercase tracking-widest text-xs">No records found</p>
                </div>
              ) : (
                patient.dailyChecks.map(check => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={check.id} 
                    className="bg-white rounded-2xl p-8 border border-natural-200 shadow-sm flex flex-col lg:flex-row gap-8"
                  >
                    <div className="shrink-0 flex flex-col items-center justify-center p-4 bg-natural-50 rounded-xl border border-natural-200 min-w-[140px] shadow-inner">
                      <Calendar className="w-4 h-4 text-natural-400 mb-2" />
                      <span className="text-lg font-serif font-bold text-natural-900">{format(new Date(check.date), 'MMM dd')}</span>
                      <span className="text-[10px] text-natural-400 font-bold tracking-widest">{format(new Date(check.date), 'HH:mm')}</span>
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                       <Metric label="Bleeding" value={check.bleeding} theme="sage" icon={<Droplets className="w-3.5 h-3.5" />} />
                       <Metric label="Airway" value={check.airway} theme="clinical" icon={<Wind className="w-3.5 h-3.5" />} />
                       <Metric label="Swallow" value={check.swallowing} theme="clay" icon={<Activity className="w-3.5 h-3.5" />} />
                       <Metric label="CN VII" value={check.facialNerve} theme="natural" icon={<User className="w-3.5 h-3.5" />} />
                       <Metric label="Hoarse" value={check.hoarseness ? 'Yes' : 'No'} theme={check.hoarseness ? 'terracotta' : 'sage'} icon={<Activity className="w-3.5 h-3.5" />} />
                       <Metric label="Drain" value={`${check.drainAmount} cc`} theme="clay" icon={<Droplets className="w-3.5 h-3.5" />} />
                       <Metric label="Temp" value={`${check.fever}°C`} theme={check.fever > 38 ? 'terracotta' : 'sage'} icon={<Thermometer className="w-3.5 h-3.5" />} />
                       <Metric label="Pain" value={`${check.painLevel}/10`} theme="terracotta" icon={<CloudLightning className="w-3.5 h-3.5" />} />
                    </div>

                    <div className="flex-1 shrink-0 pt-6 lg:pt-0 lg:pl-8 lg:border-l border-natural-100 max-w-md">
                      <p className="text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">Rounding Notes</p>
                      <p className="text-sm text-natural-900 italic font-medium leading-relaxed bg-natural-50 p-4 rounded-xl border border-natural-100">{check.notes}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, theme, icon }: { label: string, value: string, theme: string, icon: React.ReactNode }) {
  const themeMap: Record<string, string> = {
    sage: 'bg-sage-50 text-sage-700 border-sage-100',
    terracotta: 'bg-terracotta-50 text-terracotta-600 border-terracotta-100',
    clay: 'bg-clay-50 text-clay-700 border-clay-100',
    clinical: 'bg-clinical-50 text-clinical-600 border-clinical-100',
    natural: 'bg-natural-50 text-natural-600 border-natural-200',
  };

  return (
    <div className={`p-4 rounded-xl border flex flex-col gap-1 shadow-xs ${themeMap[theme] || themeMap.natural}`}>
      <div className="flex items-center gap-1.5 opacity-60">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-bold truncate leading-none mt-1">{value}</span>
    </div>
  );
}
