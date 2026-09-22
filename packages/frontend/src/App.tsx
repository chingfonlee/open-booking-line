import React, { useState, useEffect } from 'react';
import { ApplyForm } from './components/ApplyForm';
import { AdminDashboard } from './components/AdminDashboard';

export const App: React.FC = () => {
  const [view, setView] = useState<'apply' | 'admin'>('apply');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin' || window.location.pathname.startsWith('/admin')) {
      setView('admin');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f3e7] text-[#20271f]">
      {/* 示範切換列 */}
      <header className="bg-[#173820] text-[#fffdf7] border-b-4 border-[#c8ad86] px-4 py-3 sm:px-6 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🌱</span>
          <div>
            <strong className="block text-sm sm:text-base font-bold tracking-wide">行農合作社｜服務申請管理</strong>
            <small className="block text-xs text-white/80">查看客戶需求並聯絡處理</small>
          </div>
        </div>
        <nav className="flex gap-2">
          <button
            onClick={() => setView('apply')}
            className={'px-3 py-1.5 rounded-lg text-xs sm:text-sm transition font-medium ' + (
              view === 'apply'
                ? 'bg-white text-[#173820] font-bold shadow-sm'
                : 'border border-white/30 text-white/90 hover:bg-white/10'
            )}
          >
            顧客手機（LINE）
          </button>
          <button
            onClick={() => setView('admin')}
            className={'px-3 py-1.5 rounded-lg text-xs sm:text-sm transition font-medium ' + (
              view === 'admin'
                ? 'bg-white text-[#173820] font-bold shadow-sm'
                : 'border border-white/30 text-white/90 hover:bg-white/10'
            )}
          >
            合作社端（手機）
          </button>
        </nav>
      </header>

      {view === 'apply' ? <ApplyForm /> : <AdminDashboard />}
    </div>
  );
};

