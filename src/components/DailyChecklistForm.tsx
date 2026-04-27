import React, { useState, useEffect } from 'react';
import { ENTChecklist } from '../types';
import { format } from 'date-fns';
import { X, Save, Plus, GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailyChecklistFormProps {
  initialData?: ENTChecklist;
  onSubmit: (check: ENTChecklist) => void;
  onCancel: () => void;
}

export default function DailyChecklistForm({ initialData, onSubmit, onCancel }: DailyChecklistFormProps) {
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
    notes: [{ text: '', completed: false }]
  });

  useEffect(() => {
    if (initialData) {
      const normalizedNotes = Array.isArray(initialData.notes) 
        ? initialData.notes 
        : (typeof initialData.notes === 'string' ? [{ text: initialData.notes as string, completed: false }] : [{ text: '', completed: false }]);
        
      setFormData({
        ...initialData,
        notes: normalizedNotes.length > 0 ? normalizedNotes : [{ text: '', completed: false }]
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNotes = (formData.notes || []).filter(n => n.text.trim() !== '');
    onSubmit({
      ...formData as ENTChecklist,
      notes: cleanNotes.length > 0 ? cleanNotes : [{ text: '', completed: false }],
      id: initialData?.id || Math.random().toString(36).substring(7)
    });
  };

  const updateField = (field: keyof ENTChecklist, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNoteChange = (index: number, text: string) => {
    const newNotes = [...(formData.notes || [])];
    newNotes[index] = { ...newNotes[index], text };
    updateField('notes', newNotes);
  };

  const toggleNoteCompletion = (index: number) => {
    const newNotes = [...(formData.notes || [])];
    newNotes[index] = { ...newNotes[index], completed: !newNotes[index].completed };
    updateField('notes', newNotes);
  };

  const moveNote = (index: number, direction: 'up' | 'down') => {
    const newNotes = [...(formData.notes || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newNotes.length) return;
    
    [newNotes[index], newNotes[newIndex]] = [newNotes[newIndex], newNotes[index]];
    updateField('notes', newNotes);
  };

  const addNote = () => {
    updateField('notes', [...(formData.notes || []), { text: '', completed: false }]);
  };

  const removeNote = (index: number) => {
    const newNotes = (formData.notes || []).filter((_, i) => i !== index);
    updateField('notes', newNotes.length > 0 ? newNotes : [{ text: '', completed: false }]);
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
      <div className={`p-6 text-white flex justify-between items-center border-b transition-colors duration-500 ${initialData ? 'bg-sage-600 border-sage-700' : 'bg-sage-600 border-sage-700'}`}>
        <div>
          <h3 className="text-xl font-serif font-bold tracking-tight">
            {initialData ? 'Edit Ward Round Record' : 'Record Daily Evaluation'}
          </h3>
          <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${initialData ? 'text-sage-100' : 'text-sage-100'}`}>
            Ward Round: {format(new Date(formData.date || new Date()), 'yyyy-MM-dd HH:mm')}
          </p>
        </div>
        <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-natural-600">
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

          {/* Column 3: Subjective & Progress Checklist */}
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
               <div className="flex justify-between items-center mb-3">
                 <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest">Rounding Checklist</label>
                 <button 
                  type="button" 
                  onClick={addNote}
                  className="flex items-center gap-1.5 text-sage-600 hover:text-sage-700 transition-colors"
                 >
                   <Plus className="w-3 h-3" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Add Item</span>
                 </button>
               </div>
               
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 <AnimatePresence initial={false}>
                   {formData.notes?.map((note, index) => (
                     <motion.div 
                       key={index}
                       layout
                       initial={{ opacity: 0, x: -10 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: 10 }}
                       className="flex items-center gap-2 group"
                     >
                       <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                         <button 
                            type="button" 
                            onClick={() => moveNote(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-10 text-natural-400 hover:text-sage-600 transition-colors"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                         </button>
                         <button 
                            type="button" 
                            onClick={() => moveNote(index, 'down')}
                            disabled={index === (formData.notes || []).length - 1}
                            className="p-0.5 hover:bg-natural-100 rounded disabled:opacity-10 text-natural-400 hover:text-sage-600 transition-colors"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                         </button>
                       </div>
                       
                       <button
                         type="button"
                         onClick={() => toggleNoteCompletion(index)}
                         className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                           note.completed ? 'bg-sage-500 border-sage-500' : 'bg-white border-natural-200 hover:border-natural-300'
                         }`}
                       >
                         {note.completed && <X className="w-3.5 h-3.5 text-white" />}
                       </button>

                       <input 
                        type="text"
                        value={note.text}
                        onChange={(e) => handleNoteChange(index, e.target.value)}
                        placeholder={`Point ${index + 1}...`}
                        className={`flex-1 bg-natural-50 text-xs px-3 py-2 rounded-lg border focus:outline-hidden transition-all text-natural-800 placeholder-natural-300 font-medium ${
                          note.completed ? 'line-through text-natural-400 border-natural-100' : 'border-natural-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                        }`}
                       />
                       
                       <button 
                        type="button"
                        onClick={() => removeNote(index)}
                        className="p-2 text-natural-300 hover:text-terracotta-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        disabled={(formData.notes || []).length <= 1}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                     </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
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
            className={`flex items-center gap-2 text-white px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md transition-all border ${
              initialData 
                ? 'bg-sage-500 hover:bg-sage-600 shadow-sage-100 border-sage-600' 
                : 'bg-sage-500 hover:bg-sage-600 shadow-sage-100 border-sage-600'
            }`}
           >
             <Save className="w-4 h-4" />
             {initialData ? 'Update Record' : 'Save Record'}
           </button>
        </div>
      </form>
    </motion.div>
  );
}
