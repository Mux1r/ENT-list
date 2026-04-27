import React, { useState } from 'react';
import { Patient, Gender } from '../types';
import { X, Clipboard, Save, Info, FileJson, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import Papa from 'papaparse';

interface ImportModalProps {
  onImport: (patients: Patient[]) => void;
  onCancel: () => void;
}

export default function ImportModal({ onImport, onCancel }: ImportModalProps) {
  const [textData, setTextData] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');

  const processImportedData = (data: any[]) => {
    const importedPatients: Patient[] = data.map((row: any) => ({
      id: Math.random().toString(36).substring(7),
      name: row.name || row['姓名'] || 'Unknown',
      bedNumber: row.bedNumber || row['床號'] || 'N/A',
      age: parseInt(row.age || row['年齡']) || 0,
      gender: (row.gender === 'Female' || row['性別'] === '女' ? 'Female' : (row.gender === 'Other' || row['性別'] === '其他' ? 'Other' : 'Male')),
      chartNumber: row.chartNumber || row['病歷號'] || '',
      admissionDate: row.admissionDate || row['入院日期'] || new Date().toISOString().split('T')[0],
      admissionDiagnosis: row.admissionDiagnosis || row['入院診斷'] || '',
      preliminaryDiagnosis: row.preliminaryDiagnosis || row['初步診斷'] || '',
      treatmentPlan: row.treatmentPlan || row['治療計畫'] || '',
      status: 'Stable',
      dailyChecks: []
    }));

    if (importedPatients.length > 0) {
      onImport(importedPatients);
    } else {
      alert('未偵測到有效資料');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          processImportedData(Array.isArray(json) ? json : [json]);
        } catch (err) {
          alert('JSON 解析失敗');
        }
      };
      reader.readAsText(file);
    } else {
      // Handle CSV or TXT
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processImportedData(results.data),
        error: () => alert('CSV/TXT 解析失敗')
      });
    }
  };

  const handlePasteSubmit = () => {
    if (!textData.trim()) return;

    // Try to parse as JSON first
    try {
      if (textData.trim().startsWith('[') || textData.trim().startsWith('{')) {
        const json = JSON.parse(textData);
        processImportedData(Array.isArray(json) ? json : [json]);
        return;
      }
    } catch (e) {
      // Not JSON, continue to CSV/TSV
    }

    // Parse as CSV/TSV
    Papa.parse(textData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processImportedData(results.data),
      error: () => alert('貼上內容解析失敗')
    });
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
            <Clipboard className="w-6 h-6" />
            <div>
              <h3 className="text-xl font-serif font-bold">批次匯入病患資料</h3>
              <p className="text-[10px] text-sage-100 font-bold uppercase tracking-widest mt-1">
                Batch Import (CSV, TXT, JSON, Excel Paste)
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-1 px-8 bg-natural-100 flex gap-4 border-b border-natural-200">
          <button 
            onClick={() => setImportMode('file')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              importMode === 'file' ? 'border-sage-500 text-sage-600' : 'border-transparent text-natural-400'
            }`}
          >
            檔案上傳
          </button>
          <button 
            onClick={() => setImportMode('paste')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              importMode === 'paste' ? 'border-sage-500 text-sage-600' : 'border-transparent text-natural-400'
            }`}
          >
            直接貼上文字
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center bg-natural-50 p-4 rounded-xl border border-natural-200">
             <div className="flex gap-3 text-xs leading-relaxed text-natural-500">
                <Info className="w-4 h-4 shrink-0 text-sage-500" />
                <span>
                  <strong>支援格式：</strong>可直接從 Excel 複製貼上，或上傳 CSV/JSON。<br/>
                  欄位標題請包含：姓名、床號、年齡、性別、病歷號、入院診斷、治療計畫。
                </span>
             </div>
             <button 
              onClick={() => alert(`完美匯入範例 (Excel/CSV):\n姓名,床號,年齡,性別,病歷號,入院診斷,治療計畫\n江小魚,7A-15,42,男,881122,Chronic Tonsillitis,Tonsillectomy...`)}
              className="shrink-0 text-[10px] font-bold text-sage-600 hover:underline"
             >
               查看範例詳解
             </button>
          </div>

          {importMode === 'file' ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-natural-200 rounded-2xl p-12 text-center hover:border-sage-300 transition-colors bg-natural-50 relative group">
                <input 
                  type="file" 
                  accept=".csv,.txt,.json" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-3">
                  <div className="flex justify-center gap-2">
                    <FileText className="w-8 h-8 text-natural-300 group-hover:text-sage-400 transition-colors" />
                    <FileJson className="w-8 h-8 text-natural-300 group-hover:text-sage-400 transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-natural-600">點擊或拖曳檔案至此</p>
                  <p className="text-xs text-natural-400">支援 .csv, .txt (Tab/逗號分隔), .json</p>
                </div>
              </div>
              
              <div className="bg-natural-50 p-4 rounded-xl border border-natural-200 flex gap-3 text-xs leading-relaxed text-natural-500 italic">
                <Info className="w-4 h-4 shrink-0 text-sage-500" />
                <span>提示：檔案第一列應包含欄位名稱，如: name, bedNumber, age, gender, chartNumber...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea 
                rows={8}
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                placeholder="在此貼上 Excel 的內容或 JSON 陣列..."
                className="w-full px-4 py-4 bg-natural-50 border border-natural-200 rounded-xl text-xs focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-mono text-natural-800 placeholder-natural-300"
              />
              <button 
                onClick={handlePasteSubmit}
                disabled={!textData.trim()}
                className="w-full flex items-center justify-center gap-2 bg-sage-500 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md shadow-sage-100 hover:bg-sage-600 transition-all border border-sage-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                解析並匯入
              </button>
            </div>
          )}

          <div className="flex justify-end pt-4">
             <button 
              onClick={onCancel}
              className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all"
             >
               取消 Cancel
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
