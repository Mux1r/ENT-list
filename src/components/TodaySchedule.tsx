import React from 'react';
import { Patient } from '../types';
import { Scissors, ClipboardList, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

interface Props {
  patients: Patient[];
  onSelect: (id: string) => void;
}

const sameDay = (iso: string, day: string) => {
  const d = new Date(iso);
  return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === day;
};

export default function TodaySchedule({ patients, onSelect }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const active = patients.filter(p => p.status !== 'Discharged');

  // 本週一～日，每天一格
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = format(addDays(monday, i), 'yyyy-MM-dd');
    return { day, ops: active.filter(p => p.opDate === day) };
  });
  const weekOpCount = week.reduce((n, d) => n + d.ops.length, 0);

  const todo = active
    .map(p => {
      const check = p.dailyChecks?.find(c => sameDay(c.date, today));
      // 舊資料的 notes 可能是純字串
      const undone = (check?.notes ?? [])
        .map(n => (typeof n === 'string' ? { text: n as string, completed: false } : n))
        .filter(n => !n.completed);
      return { p, noCheck: !check, undone };
    })
    .filter(x => x.noCheck || x.undone.length > 0);

  const Row: React.FC<{ id: string; bed: string; name: string; children: React.ReactNode }> = ({ id, bed, name, children }) => (
    <button
      onClick={() => onSelect(id)}
      className="w-full flex items-start gap-3 px-6 py-3 text-left border-b border-natural-50 last:border-b-0 hover:bg-sage-50/50 transition-colors group"
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

  const Section: React.FC<{
    icon: React.ReactNode; title: string; count: number; empty: string; children: React.ReactNode;
  }> = ({ icon, title, count, empty, children }) => (
    <div className="bg-white rounded-2xl border border-natural-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-natural-100 bg-natural-50/60">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest text-natural-500">{title}</span>
        <span className="text-[10px] font-bold text-natural-300">{count}</span>
      </div>
      {count === 0
        ? <p className="py-10 text-center text-xs font-bold uppercase tracking-widest text-natural-300">{empty}</p>
        : children}
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-widest text-natural-400">{format(new Date(), 'yyyy/MM/dd (EEE)')}</p>

      <Section icon={<Scissors className="w-4 h-4 text-clay-500" />} title="本週手術" count={weekOpCount} empty="本週沒有排刀">
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-natural-100">
          {week.map(({ day, ops }) => (
            <div key={day} className={`min-h-24 p-3 ${day === today ? 'bg-sage-50/60' : ''}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${day === today ? 'text-sage-600' : 'text-natural-300'}`}>
                {format(new Date(day), 'EEE MM/dd')}
              </p>
              <div className="space-y-1.5">
                {ops.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="w-full text-left px-2 py-1.5 rounded-lg bg-clay-50 border border-clay-100 hover:border-clay-300 transition-colors"
                  >
                    <p className="text-xs font-bold text-natural-800 truncate">{p.bedNumber} {p.name}</p>
                    <p className="text-[11px] text-natural-500 break-words">{p.opProcedure || '術式未填'}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<ClipboardList className="w-4 h-4 text-terracotta-500" />} title="待完成 Checklist" count={todo.length} empty="全部完成">
        {todo.map(({ p, noCheck, undone }) => (
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
      </Section>
    </div>
  );
}
