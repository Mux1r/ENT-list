import React, { useState } from 'react';
import { Patient } from '../types';
import { Scissors, ClipboardList, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

interface Props {
  patients: Patient[];
  onSelect: (id: string) => void;
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

/** 當天沒記錄、或記錄裡還有沒打勾的項目 */
export const pendingTodos = (patients: Patient[], day: string) =>
  activeOnly(patients)
    .map(p => {
      const check = p.dailyChecks?.find(c => sameDay(c.date, day));
      // 舊資料的 notes 可能是純字串
      const undone = (check?.notes ?? [])
        .map(n => (typeof n === 'string' ? { text: n as string, completed: false } : n))
        .filter(n => !n.completed);
      return { p, noCheck: !check, undone };
    })
    .filter(x => x.noCheck || x.undone.length > 0);

export default function TodaySchedule({ patients, onSelect }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [tab, setTab] = useState<'op' | 'todo'>('op');
  const [pickedDay, setPickedDay] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const week = weekOps(patients, addDays(new Date(), weekOffset * 7));
  const picked = week.find(d => d.day === pickedDay) ?? week[0];

  const goWeek = (delta: number) => {
    const next = weekOps(patients, addDays(new Date(), (weekOffset + delta) * 7));
    setWeekOffset(weekOffset + delta);
    setPickedDay(next.some(d => d.day === today) ? today : next[0].day);
  };
  const todo = pendingTodos(patients, today);

  const Row: React.FC<{ id: string; bed: string; name: string; children: React.ReactNode }> = ({ id, bed, name, children }) => (
    <button
      onClick={() => onSelect(id)}
      className="w-full flex items-start gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 text-left border-b border-natural-50 last:border-b-0 hover:bg-sage-50/50 transition-colors group"
    >
      <span className="text-[10px] font-bold text-sage-600 bg-sage-50 border border-sage-100 px-2 py-0.5 rounded uppercase tracking-wider w-16 shrink-0 text-center mt-0.5">
        {bed}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-natural-900">{name}</span>
        {children}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-natural-200 group-hover:text-sage-400 shrink-0 mt-1" />
    </button>
  );

  const empty = (text: string) => (
    <p className="py-10 text-center text-xs font-bold uppercase tracking-widest text-natural-300">{text}</p>
  );

  const TABS = [
    { key: 'op' as const, label: '手術', icon: <Scissors className="w-3.5 h-3.5" />, count: week.reduce((n, d) => n + d.ops.length, 0) },
    { key: 'todo' as const, label: '待辦', icon: <ClipboardList className="w-3.5 h-3.5" />, count: todo.length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-natural-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-sage-500 text-natural-800' : 'border-transparent text-natural-400 hover:text-natural-600'
            }`}
          >
            {t.icon}
            {t.label}
            <span className="text-[10px] text-natural-300">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'op' ? (
        <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
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

          {picked.ops.length === 0
            ? empty('這天沒有排刀')
            : picked.ops.map(p => (
                <Row key={p.id} id={p.id} bed={p.bedNumber} name={p.name}>
                  <p className="text-xs text-natural-500 mt-0.5">{p.opProcedure || '術式未填'}</p>
                </Row>
              ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
          {todo.length === 0
            ? empty('全部完成')
            : todo.map(({ p, noCheck, undone }) => (
                <Row key={p.id} id={p.id} bed={p.bedNumber} name={p.name}>
                  {noCheck ? (
                    <p className="text-xs text-terracotta-500 mt-0.5 font-bold">今日尚未記錄</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {undone.map((n, i) => (
                        <li key={i} className="text-xs text-natural-500 flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-terracotta-400 shrink-0 mt-1.5" />
                          {n.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </Row>
              ))}
        </div>
      )}
    </div>
  );
}
