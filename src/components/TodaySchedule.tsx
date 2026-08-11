import React, { useState, useRef } from 'react';
import { Patient, STATUS_TONE, GENDER_TEXT } from '../types';
import { Scissors, ClipboardList, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

interface Props {
  patients: Patient[];
  onSelect: (id: string) => void;
  onUpdate: (patient: Patient) => void;
  tab: 'op' | 'todo';
  onTabChange: (tab: 'op' | 'todo') => void;
}

const sameDay = (iso: string, day: string) => {
  const d = new Date(iso);
  return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === day;
};

const activeOnly = (patients: Patient[]) => patients.filter(p => p.status !== 'Discharged');

/** 本週一～日，每天一格 */
export const weekOps = (patients: Patient[], now = new Date()) => {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const active = activeOnly(patients);
  return Array.from({ length: 7 }, (_, i) => {
    const day = format(addDays(monday, i), 'yyyy-MM-dd');
    return { day, ops: active.filter(p => p.opDate === day) };
  });
};

/**
 * 不分天，把每位病患所有記錄裡的待辦累積起來。
 * 同樣文字只留一筆，任一天沒打勾就算沒完成；沒完成的排前面，病患也是。
 */
export const pendingTodos = (patients: Patient[]) =>
  activeOnly(patients)
    .map(p => {
      const byText = new Map<string, boolean>();   // text -> completed
      for (const c of p.dailyChecks ?? []) {
        // 舊資料的 notes 可能是純字串
        for (const raw of c.notes ?? []) {
          const n = typeof raw === 'string' ? { text: raw as string, completed: false } : raw;
          if (!n.text?.trim()) continue;   // 剛按＋還沒打字的空待辦不算一件事
          byText.set(n.text, (byText.get(n.text) ?? true) && n.completed);
        }
      }
      const all = [...byText].map(([text, completed]) => ({ text, completed }));
      return { p, undone: all.filter(n => !n.completed), done: all.filter(n => n.completed) };
    })
    .filter(x => x.undone.length + x.done.length > 0)
    .sort((a, b) => Number(a.undone.length === 0) - Number(b.undone.length === 0));

/** 這裡的待辦是「同文字合併」的，勾掉就把所有記錄裡同一句話一起標成完成 */
export const setTodoDone = (p: Patient, text: string, done: boolean): Patient => ({
  ...p,
  dailyChecks: (p.dailyChecks ?? []).map(c => ({
    ...c,
    notes: (c.notes ?? []).map(raw => {
      const n = typeof raw === 'string' ? { text: raw as string, completed: false } : raw;
      return n.text === text ? { ...n, completed: done } : n;
    }),
  })),
});

export default function TodaySchedule({ patients, onSelect, onUpdate, tab, onTabChange }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [pickedDay, setPickedDay] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const week = weekOps(patients, addDays(new Date(), weekOffset * 7));
  const picked = week.find(d => d.day === pickedDay) ?? week[0];

  const goWeek = (delta: number) => {
    const next = weekOps(patients, addDays(new Date(), (weekOffset + delta) * 7));
    setWeekOffset(weekOffset + delta);
    setPickedDay(next.some(d => d.day === today) ? today : next[0].day);
  };
  const todo = pendingTodos(patients);
  const undoneCount = todo.reduce((n, x) => n + x.undone.length, 0);

  // 勾掉的待辦先留在畫面上（跟主頁的「剛出院」一樣），離開這頁才會不見
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const doneKey = (id: string, text: string) => `${id}|${text}`;
  const toggleTodo = (p: Patient, text: string, done: boolean) => {
    setJustDone(prev => {
      const next = new Set(prev);
      if (done) next.add(doneKey(p.id, text)); else next.delete(doneKey(p.id, text));
      return next;
    });
    onUpdate(setTodoDone(p, text, done));
  };

  // 勾一筆就重排的話畫面會跳。順序以「這次進頁面第一次看到的先後」為準，新出現的補在尾巴。
  const seen = useRef<string[]>([]);
  const rank = (key: string) => {
    const i = seen.current.indexOf(key);
    return i < 0 ? seen.current.push(key) - 1 : i;
  };

  // 床號＝狀態色、姓名＝性別色，與主頁同一套
  const Head: React.FC<{ p: Patient }> = ({ p }) => {
    const status = STATUS_TONE[p.status] ?? STATUS_TONE.Discharged;
    return (
      <>
        <span
          title={status.label}
          className={`px-2 py-0.5 rounded border-2 text-xs font-bold uppercase tracking-wider shrink-0 min-w-16 text-center whitespace-nowrap ${status.chip}`}
        >
          {p.bedNumber}
        </span>
        <span className={`truncate ${GENDER_TEXT[p.gender] ?? GENDER_TEXT.Other}`}>{p.name}</span>
        <span className="text-xs text-natural-400 shrink-0">{p.age}</span>
      </>
    );
  };

  const empty = (text: string) => (
    <p className="py-10 text-center text-xs font-bold uppercase tracking-widest text-natural-300">{text}</p>
  );

  const TABS = [
    { key: 'op' as const, label: '手術', icon: <Scissors className="w-3.5 h-3.5" />, count: picked.ops.length },
    { key: 'todo' as const, label: '待辦', icon: <ClipboardList className="w-3.5 h-3.5" />, count: undoneCount },
  ];

  return (
        <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
          {/* 分頁固定在最上面，日期列屬於手術分頁的內容 */}
          <div className="flex gap-1 px-2 sm:px-4 border-b border-natural-100">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                  tab === t.key ? 'border-sage-500 text-natural-800' : 'border-transparent text-natural-400 hover:text-natural-600'
                }`}
              >
                {t.icon}
                {t.label}
                <span className="text-[10px] text-natural-300">{t.count}</span>
              </button>
            ))}
          </div>

          {/* 日期只有手術用得到，待辦是不分天的累積清單 */}
          {tab === 'op' && (<>
          {/* 週切換 */}
          <div className="flex items-center justify-between px-2 sm:px-4 pt-2 sm:pt-3 bg-natural-50/60">
            <button onClick={() => goWeek(-1)} className="p-1.5 rounded-lg text-natural-300 hover:text-sage-600 hover:bg-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goWeek(-weekOffset)}
              disabled={weekOffset === 0}
              className="text-[10px] font-bold uppercase tracking-widest text-natural-400 hover:text-sage-600 disabled:text-natural-300 disabled:cursor-default transition-colors"
            >
              {format(new Date(week[0].day), 'MM/dd')} – {format(new Date(week[6].day), 'MM/dd')}
              {weekOffset !== 0 && ' · 回本週'}
            </button>
            <button onClick={() => goWeek(1)} className="p-1.5 rounded-lg text-natural-300 hover:text-sage-600 hover:bg-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 一週七點 */}
          <div className="flex justify-between gap-0.5 sm:gap-1 px-2 sm:px-4 pt-2 pb-4 border-b border-natural-100 bg-natural-50/60">
            {week.map(({ day, ops }) => {
              const isPicked = day === pickedDay;
              return (
                <button key={day} onClick={() => setPickedDay(day)} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isPicked ? 'text-sage-600' : 'text-natural-300'}`}>
                    {format(new Date(day), 'EEE')}
                  </span>
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      isPicked
                        ? 'bg-sage-500 border-sage-500 text-white shadow-sm'
                        : `bg-white text-natural-500 group-hover:border-sage-300 ${day === today ? 'border-sage-300' : 'border-natural-200'}`
                    }`}
                  >
                    {format(new Date(day), 'd')}
                  </span>
                  <span className={`text-[10px] font-bold ${ops.length === 0 ? 'text-natural-200' : isPicked ? 'text-sage-600' : 'text-clay-500'}`}>
                    {ops.length === 0 ? '—' : `${ops.length} 台`}
                  </span>
                </button>
              );
            })}
          </div>
          </>)}

          {tab === 'op' ? (
            picked.ops.length === 0
              ? empty('這天沒有排刀')
              : picked.ops.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 text-left border-b border-natural-50 last:border-b-0 hover:bg-sage-50/50 transition-colors group"
                  >
                    <Head p={p} />
                    <span className="text-xs text-natural-500 truncate">{p.opProcedure || '術式未填'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-natural-200 group-hover:text-sage-400 shrink-0 ml-auto" />
                  </button>
                ))
          ) : (() => {
            // 只列還沒完成的；剛剛在這頁勾掉的先留著
            const rows = todo
              .map(({ p, undone, done }) => ({
                p,
                items: [...undone, ...done.filter(n => justDone.has(doneKey(p.id, n.text)))]
                  .sort((a, b) => rank(doneKey(p.id, a.text)) - rank(doneKey(p.id, b.text))),
              }))
              .filter(x => x.items.length > 0)
              .sort((a, b) => rank(a.p.id) - rank(b.p.id));
            return rows.length === 0
              ? empty('沒有待辦')
              : rows.map(({ p, items }) => (
                  <div key={p.id} className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-natural-50 last:border-b-0">
                    <button
                      onClick={() => onSelect(p.id)}
                      className="w-full flex items-center gap-2 sm:gap-3 text-left hover:bg-sage-50/50 -mx-1 px-1 rounded-lg transition-colors group"
                    >
                      <Head p={p} />
                      <ChevronRight className="w-3.5 h-3.5 text-natural-200 group-hover:text-sage-400 shrink-0 ml-auto" />
                    </button>
                    <ul className="mt-1.5 space-y-1">
                      {items.map(n => {
                        const checked = n.completed || justDone.has(doneKey(p.id, n.text));
                        return (
                          <li key={n.text} className="flex items-start gap-2">
                            <button
                              onClick={() => toggleTodo(p, n.text, !checked)}
                              title={checked ? '取消完成' : '標為完成'}
                              className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                checked ? 'bg-sage-400 border-sage-500' : 'bg-white border-natural-300 hover:border-sage-400'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </button>
                            <span className={`text-xs ${checked ? 'text-natural-300 line-through' : 'text-natural-600'}`}>
                              {n.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ));
          })()}
        </div>
  );
}
