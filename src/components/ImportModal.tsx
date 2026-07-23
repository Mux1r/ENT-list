import React, { useState, useRef, useEffect } from 'react';
import { Patient, Gender } from '../types';
import { X, Clipboard, Save, Info, FileJson, FileText, ImageIcon, Loader2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import Papa from 'papaparse';
import { analyzePatientListImage, ExtractedPatientRow } from '../services/geminiService';

interface ImportModalProps {
  onImport: (patients: Patient[]) => void;
  onCancel: () => void;
}

type ImportMode = 'file' | 'paste' | 'screenshot';

export default function ImportModal({ onImport, onCancel }: ImportModalProps) {
  const [textData, setTextData] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('screenshot');

  // Screenshot tab state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedRows, setExtractedRows] = useState<ExtractedPatientRow[] | null>(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isStructuredPatient = (obj: any): boolean =>
    obj && typeof obj === 'object' && ('admissionDiagnosis' in obj || 'dailyChecks' in obj || 'admissionDate' in obj);

  const normalizeStructuredPatient = (row: any): Patient => ({
    id: '',
    name: row.name || row['姓名'] || 'Unknown',
    bedNumber: row.bedNumber || row['床號'] || 'N/A',
    age: typeof row.age === 'number' ? row.age : (parseInt(row.age || row['年齡']) || 0),
    gender: (row.gender === 'Female' || row['性別'] === '女' ? 'Female' : (row.gender === 'Other' || row['性別'] === '其他' ? 'Other' : 'Male')) as Gender,
    chartNumber: row.chartNumber || row['病歷號'] || '',
    admissionDate: row.admissionDate || row['入院日期'] || new Date().toISOString().split('T')[0],
    diagnosis: row.diagnosis || row.admissionDiagnosis || row['診斷'] || row['入院診斷'] || '',
    status: (['Stable', 'Critical', 'Discharge Pending'].includes(row.status) ? row.status : 'Stable') as Patient['status'],
    medications: Array.isArray(row.medications) ? row.medications.map((m: any) => ({ ...m, id: crypto.randomUUID() })) : [],
    labTests: Array.isArray(row.labTests) ? row.labTests.map((l: any) => ({ ...l, id: crypto.randomUUID() })) : [],
    examinations: Array.isArray(row.examinations) ? row.examinations.map((e: any) => ({ ...e, id: crypto.randomUUID() })) : [],
    dailyChecks: Array.isArray(row.dailyChecks) ? row.dailyChecks.map((c: any) => ({ ...c, id: crypto.randomUUID() })) : [],
  });

  const processImportedData = (data: any[]) => {
    if (data.length === 0) { alert('未偵測到有效資料'); return; }

    const importedPatients: Patient[] = isStructuredPatient(data[0])
      ? data.map(normalizeStructuredPatient)
      : data.map((row: any) => ({
          id: '',
          name: row.name || row['姓名'] || 'Unknown',
          bedNumber: row.bedNumber || row['床號'] || 'N/A',
          age: parseInt(row.age || row['年齡']) || 0,
          gender: (row.gender === 'Female' || row['性別'] === '女' ? 'Female' : (row.gender === 'Other' || row['性別'] === '其他' ? 'Other' : 'Male')) as Gender,
          chartNumber: row.chartNumber || row['病歷號'] || '',
          admissionDate: row.admissionDate || row['入院日期'] || new Date().toISOString().split('T')[0],
          diagnosis: row.diagnosis || row.admissionDiagnosis || row['診斷'] || row['入院診斷'] || '',
          status: 'Stable' as Patient['status'],
          medications: [],
          labTests: [],
          examinations: [],
          dailyChecks: [],
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
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processImportedData(results.data),
        error: () => alert('CSV/TXT 解析失敗')
      });
    }
  };

  const handlePasteSubmit = () => {
    const raw = textData.trim();
    if (!raw) return;

    if (raw.startsWith('[') || raw.startsWith('{')) {
      try {
        const json = JSON.parse(raw);
        processImportedData(Array.isArray(json) ? json : [json]);
      } catch {
        alert('JSON 格式有誤，請確認貼上的內容是完整的 JSON（不要包含 ```json 標記）');
      }
      return;
    }

    Papa.parse(textData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processImportedData(results.data as any[]),
      error: () => alert('貼上內容解析失敗')
    });
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setExtractedRows(null);
    setAnalyzeError('');
  };

  // Ctrl+V 直接貼上截圖（螢幕擷取工具會把圖片放進剪貼簿）
  useEffect(() => {
    if (importMode !== 'screenshot') return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items || [])
        .find(i => i.type.startsWith('image/'))?.getAsFile();
      if (file) { e.preventDefault(); handleImageSelect(file); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importMode]);

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setAnalyzeError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        const rows = await analyzePatientListImage(base64, imageFile.type);
        if (rows.length === 0) {
          setAnalyzeError('截圖解析結果為空，建議：① 確認截圖夠清晰 ② 截取僅包含病患清單的區域（去除多餘邊框）再重試。');
        } else {
          setExtractedRows(rows);
        }
      } catch (err: any) {
        const msg: string = err?.message || '';
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          setAnalyzeError('Gemini API 配額已用盡（429）。請至 Google AI Studio 啟用付費方案，或等待明日配額重置後再試。');
        } else if (msg.includes('API_KEY') || msg.includes('401') || msg.includes('403')) {
          setAnalyzeError('API Key 無效或未授權，請確認 .env 中的 GEMINI_API_KEY 是否正確。');
        } else {
          setAnalyzeError(`分析失敗：${msg || '未知錯誤，請重試。'}`);
        }
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(imageFile);
  };

  const handleConfirmScreenshot = () => {
    if (!extractedRows) return;
    const today = new Date().toISOString().split('T')[0];
    const patients: Patient[] = extractedRows.map(row => ({
      id: '',
      name: row.name,
      bedNumber: row.bedNumber,
      chartNumber: row.chartNumber,
      age: row.age,
      gender: (row.gender === 'Female' ? 'Female' : 'Male') as Gender,
      admissionDate: row.admissionDate || today,
      diagnosis: '',
      status: 'Stable',
      medications: [],
      labTests: [],
      examinations: [],
      clinicalPearls: [],
      dailyChecks: [],
    }));
    onImport(patients);
  };

  const tabClass = (mode: ImportMode) =>
    `px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
      importMode === mode ? 'border-sage-500 text-sage-600' : 'border-transparent text-natural-400'
    }`;

  return (
    <div className="fixed inset-0 bg-natural-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-natural-200"
      >
        <div className="bg-sage-600 p-4 sm:p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Clipboard className="w-6 h-6" />
            <div>
              <h3 className="text-xl font-serif font-bold">批次匯入病患資料</h3>
              <p className="text-[10px] text-sage-100 font-bold uppercase tracking-widest mt-1">
                Batch Import (Screenshot / CSV / JSON)
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-white opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-1 px-3 sm:px-8 bg-natural-100 flex gap-2 sm:gap-4 border-b border-natural-200 overflow-x-auto no-scrollbar">
          <button onClick={() => setImportMode('screenshot')} className={tabClass('screenshot')}>
            截圖匯入
          </button>
          <button onClick={() => setImportMode('file')} className={tabClass('file')}>
            檔案上傳
          </button>
          <button onClick={() => setImportMode('paste')} className={tabClass('paste')}>
            直接貼上文字
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-5">
          {/* ── Screenshot tab ── */}
          {importMode === 'screenshot' && (
            <div className="space-y-4">
              <div className="flex gap-3 text-xs leading-relaxed text-natural-500 bg-natural-50 p-4 rounded-xl border border-natural-200">
                <Info className="w-4 h-4 shrink-0 text-sage-500 mt-0.5" />
                <span>上傳病患清單截圖（需包含床號、病歷號、姓名、年齡），AI 將自動解析並建立病患。已存在的病歷號將自動略過。</span>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-natural-200 rounded-2xl p-4 sm:p-8 text-center hover:border-sage-300 transition-colors bg-natural-50 relative group cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.type.startsWith('image/')) handleImageSelect(file);
                }}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                />
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="w-10 h-10 text-natural-300 group-hover:text-sage-400 mx-auto transition-colors" />
                    <p className="text-sm font-bold text-natural-600">點擊、拖曳，或直接按 Ctrl+V 貼上截圖</p>
                    <p className="text-xs text-natural-400">支援 JPG、PNG、WebP</p>
                  </div>
                )}
              </div>

              {analyzeError && (
                <p className="text-xs text-terracotta-600 bg-terracotta-50 border border-terracotta-100 rounded-lg px-4 py-2">{analyzeError}</p>
              )}

              {/* Extracted result table */}
              {extractedRows && extractedRows.length > 0 && (
                <div className="border border-natural-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-natural-100 text-natural-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">床號</th>
                        <th className="px-4 py-2 text-left font-bold">病歷號</th>
                        <th className="px-4 py-2 text-left font-bold">姓名</th>
                        <th className="px-4 py-2 text-left font-bold">性別</th>
                        <th className="px-4 py-2 text-left font-bold">年齡</th>
                        <th className="px-4 py-2 text-left font-bold">入院日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-natural-50'}>
                          <td className="px-4 py-2 font-medium">{row.bedNumber}</td>
                          <td className="px-4 py-2 text-natural-400">{row.chartNumber}</td>
                          <td className="px-4 py-2 font-bold text-natural-900">{row.name}</td>
                          <td className="px-4 py-2">{row.gender === 'Female' ? '女' : '男'}</td>
                          <td className="px-4 py-2">{row.age}</td>
                          <td className="px-4 py-2 text-natural-400">{row.admissionDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button onClick={onCancel} className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all">
                  取消
                </button>
                <div className="flex gap-3">
                  {imageFile && !extractedRows && (
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="flex items-center gap-2 bg-sage-500 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-sage-600 transition-all disabled:opacity-60"
                    >
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      {analyzing ? '分析中...' : '分析截圖'}
                    </button>
                  )}
                  {extractedRows && extractedRows.length > 0 && (
                    <>
                      <button
                        onClick={() => { setExtractedRows(null); setImageFile(null); setImagePreviewUrl(null); }}
                        className="px-4 py-2.5 rounded-lg border border-natural-200 text-natural-500 font-bold text-xs uppercase tracking-widest hover:bg-natural-50 transition-all"
                      >
                        重新選擇
                      </button>
                      <button
                        onClick={handleConfirmScreenshot}
                        className="flex items-center gap-2 bg-sage-500 text-white px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-sage-600 transition-all"
                      >
                        <Check className="w-4 h-4" />
                        確認匯入 {extractedRows.length} 位
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── File upload tab ── */}
          {importMode === 'file' && (
            <div className="space-y-4">
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
              <div className="flex justify-end pt-2">
                <button onClick={onCancel} className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all">
                  取消 Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Paste tab ── */}
          {importMode === 'paste' && (
            <div className="space-y-4">
              <textarea
                rows={8}
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                placeholder="在此貼上 Excel 的內容或 JSON 陣列..."
                className="w-full px-4 py-4 bg-natural-50 border border-natural-200 rounded-xl text-xs focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 outline-hidden transition-all resize-none font-mono text-natural-800 placeholder-natural-300"
              />
              <div className="flex justify-between items-center">
                <button onClick={onCancel} className="px-6 py-2.5 rounded-lg text-natural-400 font-bold text-xs uppercase tracking-widest hover:text-natural-600 transition-all">
                  取消 Cancel
                </button>
                <button
                  onClick={handlePasteSubmit}
                  disabled={!textData.trim()}
                  className="flex items-center gap-2 bg-sage-500 text-white py-3 px-6 rounded-lg font-bold text-xs uppercase tracking-widest shadow-md shadow-sage-100 hover:bg-sage-600 transition-all border border-sage-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  解析並匯入
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
