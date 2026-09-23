import React, { useState, useEffect } from 'react';
import { ApplyForm } from './components/ApplyForm';
import { AdminDashboard } from './components/AdminDashboard';

export const App: React.FC = () => {
  const [view, setView] = useState<'apply' | 'admin'>('apply');
  const [showDemoNav, setShowDemoNav] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin' || window.location.pathname.startsWith('/admin')) {
      setView('admin');
    } else {
      setView('apply');
    }
    // 只有在明確加入 ?demo=1 參數時才顯示切換列（提供簡報示範備用）
    if (params.get('demo') === '1' || params.get('demo') === 'true') {
      setShowDemoNav(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f3e7] text-[#20271f]">
      {/* 僅在明確帶有 ?demo=1 時才顯示示範切換列 */}
      {showDemoNav && (
        <header className="bg-[#173820] text-[#fffdf7] border-b-4 border-[#c8ad86] px-4 py-2 sm:px-6 flex items-center justify-between gap-4 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <span>🧪</span>
            <span className="font-semibold text-white/90">示範切換模式</span>
          </div>
          <nav className="flex gap-2">
            <button
              onClick={() => setView('apply')}
              className={'px-3 py-1 rounded-lg transition font-medium ' + (
                view === 'apply'
                  ? 'bg-white text-[#173820] font-bold shadow-sm'
                  : 'border border-white/30 text-white/90 hover:bg-white/10'
              )}
            >
              顧客手機（LINE）
            </button>
            <button
              onClick={() => setView('admin')}
              className={'px-3 py-1 rounded-lg transition font-medium ' + (
                view === 'admin'
                  ? 'bg-white text-[#173820] font-bold shadow-sm'
                  : 'border border-white/30 text-white/90 hover:bg-white/10'
              )}
            >
              合作社端（手機）
            </button>
          </nav>
        </header>
      )}

      {view === 'apply' ? <ApplyForm /> : <AdminDashboard />}
    </div>
  );
};

