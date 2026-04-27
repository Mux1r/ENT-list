import React, { useState } from 'react';
import { ENTChecklist } from '../types';
import { format } from 'date-fns';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';

interface DailyChecklistFormProps {
  onSubmit: (check: ENTChecklist) => void;
  onCancel: () => void;
}

export default function DailyChecklistForm({ onSubmit, onCancel }: DailyChecklistFormProps) {
  const [formData, setFormData] = useState<Partial<ENTChecklist>>({
    date: new Date().toISOString(),
    bleeding: 'None',
    airway: 'Clear',
    swallowing: 'Normal',
    facialNerve: 'Intact',
    hoarseness: false,
    drainAmount: 0,
    woundStatus: 'Clean',
    painLevel: 0,
    fever: 36.5,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData as ENTChecklist,
      id: Math.random().toString(36).substring(7)
    });
  };

  const updateField = (field: keyof ENTChecklist, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const SelectionButton = ({ field, value, label, activeColor }: { field: keyof ENTChecklist, value: string, label: string, activeColor: string }) => (
    <button
      type="button"
      onClick={() => updateField(field, value)}
      className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all uppercase tracking-widest ${
        formData[field] === value 
          ? `${activeColor} text-white border-transparent shadow-sm` 
          : 'bg-white text-natural-400 border-natural-200 hover:border-natural-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="bg-white rounded-2xl border border-natural-200 shadow-xl overflow-hidden mb-8"
    >
      <div className="bg-sage-600 p-6 text-white flex justify-between items-center border-b border-sage-700">
        <div>
          <h3 className="text-xl font-serif font-bold tracking-tight">Record Daily Evaluation</h3>
          <p className="text-[10px] text-sage-100 font-bold uppercase tracking-widest mt-1">
            Ward Round: {format(new Date(), 'yyyy-MM-dd HH:mm')}
          </p>
        </div>
        <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Primary Vitals */}
          <div className="space-y-6">
             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">Bleeding Assessment</label>
               <div className="flex gap-2">
                 <SelectionButton field="bleeding" value="None" label="None" activeColor="bg-sage-500" />
                 <SelectionButton field="bleeding" value="Minor" label="Minor" activeColor="bg-clay-500" />
                 <SelectionButton field="bleeding" value="Significant" label="Major" activeColor="bg-terracotta-500" />
               </div>
             </div>

             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">Airway Status</label>
               <div className="flex gap-2">
                 <SelectionButton field="airway" value="Clear" label="Clear" activeColor="bg-sage-500" />
                 <SelectionButton field="airway" value="Stridor" label="Stridor" activeColor="bg-terracotta-500" />
                 <SelectionButton field="airway" value="Obstructed" label="Blocked" activeColor="bg-natural-900" />
               </div>
             </div>

             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">Swallowing / Diet</label>
               <div className="flex gap-2">
                 <SelectionButton field="swallowing" value="Normal" label="Normal" activeColor="bg-sage-500" />
                 <SelectionButton field="swallowing" value="Dysphagia" label="Diff" activeColor="bg-clay-500" />
                 <SelectionButton field="swallowing" value="NPO" label="NPO" activeColor="bg-natural-600" />
               </div>
             </div>
          </div>

          {/* Column 2: Clinical Signs */}
          <div className="space-y-6">
             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">CN VII (Facial Nerve)</label>
               <div className="flex gap-2">
                 <SelectionButton field="facialNerve" value="Intact" label="Intact" activeColor="bg-sage-500" />
                 <SelectionButton field="facialNerve" value="Paresis" label="Paresis" activeColor="bg-clay-500" />
                 <SelectionButton field="facialNerve" value="Paralysis" label="Palsy" activeColor="bg-natural-600" />
               </div>
             </div>

             <div className="flex items-center gap-4 py-2">
               <label className="flex items-center gap-3 cursor-pointer group">
                 <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                   formData.hoarseness ? 'bg-terracotta-500 border-terracotta-500' : 'bg-white border-natural-200 group-hover:border-natural-300'
                 }`}>
                   {formData.hoarseness && <X className="w-3.5 h-3.5 text-white" />}
                 </div>
                 <input 
                  type="checkbox" 
                  className="hidden"
                  checked={formData.hoarseness} 
                  onChange={(e) => updateField('hoarseness', e.target.checked)}
                 />
                 <span className="text-xs font-bold text-natural-600">Hoarseness / Voice Change</span>
               </label>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Drain (cc)</label>
                  <input 
                    type="number" 
                    value={formData.drainAmount}
                    onChange={(e) => updateField('drainAmount', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm outline-hidden focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all font-bold text-natural-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Temp (°C)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={formData.fever}
                    onChange={(e) => updateField('fever', parseFloat(e.target.value))}
                    className="w-full px-4 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm outline-hidden focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all font-bold text-natural-900"
                  />
                </div>
             </div>
          </div>

          {/* Column 3: Subjective & Progress */}
          <div className="space-y-6">
             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Pain Level (VAS)</label>
               <div className="pt-2">
                 <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={formData.painLevel}
                  onChange={(e) => updateField('painLevel', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-natural-200 rounded-lg appearance-none cursor-pointer accent-sage-500"
                 />
                 <div className="flex justify-between items-center mt-3 font-bold text-[9px] uppercase tracking-tighter">
                   <span className="text-sage-600">None</span>
                   <span className="bg-sage-100 text-sage-700 px-2 py-0.5 rounded border border-sage-200">Value: {formData.painLevel}</span>
                   <span className="text-terracotta-500">Severe</span>
                 </div>
               </div>
             </div>

             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Clinical Rounding Notes</label>
               <textarea 
                rows={3}
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Enter clinical observations, plans..."
                className="w-full px-4 py-3 bg-natural-50 border border-natural-200 rounded-xl text-xs focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-medium text-natural-800 placeholder-natural-300 italic"
               />
             </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-natural-100">
           <button 
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all"
           >
             Discard
           </button>
           <button 
            type="submit"
            className="flex items-center gap-2 bg-sage-500 text-white px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md shadow-sage-100 hover:bg-sage-600 transition-all border border-sage-600"
           >
             <Save className="w-4 h-4" />
             Save Record
           </button>
        </div>
      </form>
    </motion.div>
  );
}
