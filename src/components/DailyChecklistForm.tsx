import React, { useState, useEffect } from 'react';
import { ENTChecklist } from '../types';
import { format } from 'date-fns';
import { X, Save, Plus, GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailyChecklistFormProps {
  initialData?: ENTChecklist;
  /** 要記錄哪一天（yyyy-MM-dd）；不給就是今天 */
  day?: string;
  onSubmit: (check: ENTChecklist) => void;
  onCancel: () => void;
}

export default function DailyChecklistForm({ initialData, day, onSubmit, onCancel }: DailyChecklistFormProps) {
  // 不預填任何評估值 —— 沒點過的項目維持 undefined（未評估），
  // 才不會把「沒看」記錄成「看了，正常」。
  const [formData, setFormData] = useState<Partial<ENTChecklist>>({
    date: day ? new Date(`${day}T${format(new Date(), 'HH:mm')}`).toISOString() : new Date().toISOString(),
    notes: [{ text: '', completed: false }]
  });
  // 待辦／評估項目分開填，與查房卡片的小分頁一致
  const [tab, setTab] = useState<'todo' | 'assess'>('todo');

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

  // 再點一次已選的值即取消 → 回到「未評估」
  const SelectionButton = ({ field, value, label, activeColor }: { field: keyof ENTChecklist, value: string, label: string, activeColor: string }) => (
    <button
      type="button"
      title={formData[field] === value ? '再點一次可取消（未評估）' : undefined}
      onClick={() => updateField(field, formData[field] === value ? undefined : value)}
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
      <div className="px-4 sm:px-6 py-2 text-white flex justify-end items-center border-b bg-sage-600 border-sage-700">
        <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6 sm:space-y-8">
        <div className="flex gap-1 border-b border-natural-100">
          {([['todo', '待辦'], ['assess', '評估項目']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-sage-500 text-natural-800' : 'border-transparent text-natural-400 hover:text-natural-600'
              }`}
            >
              {label}
              <span className="ml-2 text-[10px] text-natural-300">
                {key === 'todo'
                  ? (formData.notes || []).filter(n => n.text.trim() !== '' && !n.completed).length
                  : Object.entries(formData).filter(([k, v]) => k !== 'date' && k !== 'id' && k !== 'notes' && v !== undefined).length}
              </span>
            </button>
          ))}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-natural-600 ${tab === 'assess' ? '' : 'hidden'}`}>
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

             <div>
               <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-3">Hoarseness / Voice Change</label>
               <div className="flex gap-2">
                 {/* 用與其他項目一致的按鈕組，才能表達「未評估」 */}
                 <button
                   type="button"
                   onClick={() => updateField('hoarseness', formData.hoarseness === false ? undefined : false)}
                   className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all uppercase tracking-widest ${
                     formData.hoarseness === false ? 'bg-sage-500 text-white border-transparent shadow-sm' : 'bg-white text-natural-400 border-natural-200 hover:border-natural-300'
                   }`}
                 >No</button>
                 <button
                   type="button"
                   onClick={() => updateField('hoarseness', formData.hoarseness === true ? undefined : true)}
                   className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all uppercase tracking-widest ${
                     formData.hoarseness === true ? 'bg-terracotta-500 text-white border-transparent shadow-sm' : 'bg-white text-natural-400 border-natural-200 hover:border-natural-300'
                   }`}
                 >Yes</button>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Drain (cc)</label>
                  <input
                    type="number"
                    placeholder="未評估"
                    value={formData.drainAmount ?? ''}
                    onChange={(e) => updateField('drainAmount', e.target.value === '' ? undefined : parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-natural-50 border border-natural-200 rounded-lg text-sm outline-hidden focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all font-bold text-natural-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-natural-400 uppercase tracking-widest mb-2">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="未評估"
                    value={formData.fever ?? ''}
                    onChange={(e) => updateField('fever', e.target.value === '' ? undefined : parseFloat(e.target.value))}
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
                  value={formData.painLevel ?? 0}
                  onChange={(e) => updateField('painLevel', parseInt(e.target.value))}
                  className={`w-full h-1.5 bg-natural-200 rounded-lg appearance-none cursor-pointer accent-sage-500 ${formData.painLevel === undefined ? 'opacity-40' : ''}`}
                 />
                 <div className="flex justify-between items-center mt-3 font-bold text-[9px] uppercase tracking-tighter">
                   <span className="text-sage-600">None</span>
                   {/* slider 無法表達「未評估」，故用可點的徽章切換 */}
                   <button
                     type="button"
                     onClick={() => updateField('painLevel', formData.painLevel === undefined ? 0 : undefined)}
                     title={formData.painLevel === undefined ? '點擊開始記錄' : '點擊標為未評估'}
                     className={`px-2 py-0.5 rounded border transition-colors ${
                       formData.painLevel === undefined
                         ? 'bg-natural-50 text-natural-400 border-natural-200 hover:border-sage-400'
                         : 'bg-sage-100 text-sage-700 border-sage-200'
                     }`}
                   >
                     {formData.painLevel === undefined ? '未評估' : `Value: ${formData.painLevel}`}
                   </button>
                   <span className="text-terracotta-500">Severe</span>
                 </div>
               </div>
             </div>

          </div>
        </div>

        <div className={`max-w-md ${tab === 'todo' ? '' : 'hidden'}`}>
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
                       <div className="flex flex-col gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
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
                        className="p-2 text-natural-300 hover:text-terracotta-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-10"
                        disabled={(formData.notes || []).length <= 1}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                     </motion.div>
                   ))}
                 </AnimatePresence>
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
