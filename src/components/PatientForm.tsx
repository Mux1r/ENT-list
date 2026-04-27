import React, { useState } from 'react';
import { Patient, Gender } from '../types';
import { X, Save, UserPlus, FileEdit } from 'lucide-react';
import { motion } from 'motion/react';

interface PatientFormProps {
  patient?: Patient; // If provided, we are editing
  onSubmit: (patient: Patient) => void;
  onCancel: () => void;
}

export default function PatientForm({ patient, onSubmit, onCancel }: PatientFormProps) {
  const [formData, setFormData] = useState<Partial<Patient>>(
    patient || {
      name: '',
      bedNumber: '',
      age: 0,
      gender: 'Male',
      chartNumber: '',
      admissionDate: new Date().toISOString().split('T')[0],
      admissionDiagnosis: '',
      preliminaryDiagnosis: '',
      treatmentPlan: '',
      status: 'Stable',
      dailyChecks: []
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.bedNumber) {
      alert('請填寫姓名與床號');
      return;
    }

    onSubmit({
      ...formData as Patient,
      id: patient?.id || Math.random().toString(36).substring(7)
    });
  };

  const updateField = (field: keyof Patient, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-natural-200"
      >
        <div className="bg-sage-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            {patient ? <FileEdit className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
            <div>
              <h3 className="text-xl font-serif font-bold">{patient ? '修改病患資料' : '新增病患登記'}</h3>
              <p className="text-[10px] text-sage-100 font-bold uppercase tracking-widest mt-1">
                Patient Registration & Records
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Basic Info Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">姓名 Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all"
                placeholder="輸入姓名"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">床號 Bed</label>
              <input 
                type="text" 
                value={formData.bedNumber}
                onChange={(e) => updateField('bedNumber', e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all text-center"
                placeholder="7A-01"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">年齡 Age</label>
              <input 
                type="number" 
                value={formData.age}
                onChange={(e) => updateField('age', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">性別 Gender</label>
              <select 
                value={formData.gender}
                onChange={(e) => updateField('gender', e.target.value as Gender)}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all"
              >
                <option value="Male">男 Male</option>
                <option value="Female">女 Female</option>
                <option value="Other">其他 Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">病歷號 Chart No.</label>
              <input 
                type="text" 
                value={formData.chartNumber}
                onChange={(e) => updateField('chartNumber', e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all"
                placeholder="1234567"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">入住日 Admin Date</label>
              <input 
                type="date" 
                value={formData.admissionDate}
                onChange={(e) => updateField('admissionDate', e.target.value)}
                className="w-full px-4 py-2.5 bg-natural-50 border border-natural-200 rounded-lg text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden font-bold transition-all"
              />
            </div>
          </div>

          {/* Diagnoses */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">入院診斷 Admission Diagnosis</label>
              <textarea 
                rows={2}
                value={formData.admissionDiagnosis}
                onChange={(e) => updateField('admissionDiagnosis', e.target.value)}
                className="w-full px-4 py-3 bg-natural-50 border border-natural-200 rounded-xl text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-medium text-natural-800 placeholder-natural-300 italic"
                placeholder="例: Laryngeal cancer, cT3N1M0..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">初步診斷 Preliminary Diagnosis</label>
              <textarea 
                rows={2}
                value={formData.preliminaryDiagnosis}
                onChange={(e) => updateField('preliminaryDiagnosis', e.target.value)}
                className="w-full px-4 py-3 bg-natural-50 border border-natural-200 rounded-xl text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-medium text-natural-800 placeholder-natural-300 italic"
                placeholder="例: S/P Total Laryngectomy..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2 px-1">治療計畫 Treatment Plan</label>
              <textarea 
                rows={4}
                value={formData.treatmentPlan}
                onChange={(e) => updateField('treatmentPlan', e.target.value)}
                className="w-full px-4 py-3 bg-natural-50 border border-natural-200 rounded-xl text-sm focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-medium text-natural-800 placeholder-natural-300 italic"
                placeholder="1. Medication: Cefazolin...&#10;2. Procedure: Drain monitoring..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-natural-100">
             <button 
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all"
             >
               取消 Cancel
             </button>
             <button 
              type="submit"
              className="flex items-center gap-2 bg-sage-500 text-white px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md shadow-sage-100 hover:bg-sage-600 transition-all border border-sage-600"
             >
               <Save className="w-4 h-4" />
               儲存病患資料
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
