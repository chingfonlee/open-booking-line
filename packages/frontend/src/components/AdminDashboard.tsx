import React, { useState, useEffect } from 'react';
import { ServiceRequest, RequestStatus } from '../../../shared/types';
import { Phone, CheckCircle2, RefreshCw, X, MapPin, KeyRound, LogOut, Loader2 } from 'lucide-react';

const ADMIN_PIN_KEY = 'xingnong_admin_pin';

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<ServiceRequest | null>(null);
  const [currentFilter, setCurrentFilter] = useState<RequestStatus | 'all'>('to_contact');
  const [counts, setCounts] = useState({ to_contact: 0, processing: 0, closed: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // 1. 頁面載入時向後端確認本機儲存的 PIN 是否仍有效
  useEffect(() => {
    const savedPin = localStorage.getItem(ADMIN_PIN_KEY);
    if (!savedPin) {
      setIsCheckingAuth(false);
      return;
    }

    fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: savedPin })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(ADMIN_PIN_KEY);
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        // 離線情況下保留已存狀態
        setIsAuthenticated(true);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  const fetchRequests = async () => {
    const pin = localStorage.getItem(ADMIN_PIN_KEY) || '';
    if (!pin) return;

    setLoading(true);
    try {
      const url = currentFilter === 'all' 
        ? '/api/admin/requests' 
        : `/api/admin/requests?status=${currentFilter}`;
      const res = await fetch(url, {
        headers: { 'x-admin-pin': pin }
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem(ADMIN_PIN_KEY);
      }
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [currentFilter, isAuthenticated]);

  const handleUpdateStatus = async (id: string, newStatus: RequestStatus, memo?: string) => {
    const pin = localStorage.getItem(ADMIN_PIN_KEY) || '';
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-pin': pin
        },
        body: JSON.stringify({ status: newStatus, admin_memo: memo })
      });
      const data = await res.json();
      if (data.success) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, admin_memo: memo ?? r.admin_memo } : r));
        if (selectedReq && selectedReq.id === id) {
          setSelectedReq({ ...selectedReq, status: newStatus, admin_memo: memo ?? selectedReq.admin_memo });
        }
        fetchRequests();
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem(ADMIN_PIN_KEY);
      }
    } catch (err) {
      alert('更新失敗');
    } finally {
      setSavingStatus(false);
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'to_contact':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef3c7] text-[#856200] border border-[#fde68a]">待聯絡</span>;
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe]">處理中</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">已結案</span>;
    }
  };

  const getTimeSlotText = (slot: string) => {
    if (slot === 'morning') return '上午';
    if (slot === 'afternoon') return '下午';
    return '皆可';
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-[#657061] font-semibold">
          <Loader2 className="w-5 h-5 animate-spin text-[#2a5937]" />
          <span>正在確認管理權限...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputPin.trim();
      if (!trimmed) {
        setPinError('請輸入管理密碼');
        return;
      }

      setIsVerifying(true);
      setPinError('');
      try {
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: trimmed })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem(ADMIN_PIN_KEY, trimmed);
          setIsAuthenticated(true);
          setPinError('');
        } else {
          setPinError(data.message || '密碼錯誤，請輸入正確的站所管理密碼');
        }
      } catch {
        setPinError('連線異常，請檢查網路連線');
      } finally {
        setIsVerifying(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center p-4">
        <div className="bg-[#fffdf7] max-w-sm w-full rounded-2xl shadow-xl border border-[#c8ad86] p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-[#eee2cf] text-[#173820] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#c8ad86]">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#20271f] mb-1">站所幹部管理登入</h2>
          <p className="text-xs text-[#657061] mb-6">
            高雄服務站 · 請輸入站所通行密碼以保護農友資料隱私
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={12}
                value={inputPin}
                onChange={(e) => {
                  setInputPin(e.target.value);
                  setPinError('');
                }}
                placeholder="請輸入站所密碼"
                autoFocus
                disabled={isVerifying}
                className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none bg-white text-[#20271f] disabled:opacity-50"
              />
              {pinError && (
                <p className="text-xs text-red-600 font-semibold mt-2">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-[#2a5937] hover:bg-[#173820] disabled:bg-[#657061] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>驗證中...</span>
                </>
              ) : (
                <span>驗證進入管理後台</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#e0d9cb]">
            <a
              href="/"
              className="text-xs text-[#657061] hover:text-[#20271f] font-medium"
            >
              ← 返回農友預約表單
            </a>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#f3f0e8] pb-20 text-[#20271f]">
      <header className="bg-white border-b border-[#e7e3da] sticky top-0 z-10 px-4 py-3 sm:px-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2a5937]"></span>
            <span className="text-xs font-bold text-[#657061]">高雄服務站</span>
          </div>
          <h1 className="text-lg font-black text-[#173820]">服務申請管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="p-2 text-[#657061] hover:text-[#20271f] rounded-lg hover:bg-[#eee2cf] border border-[#d8d1c3] text-xs font-semibold flex items-center gap-1 transition"
            title="重新整理資料"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
            <span className="hidden sm:inline">重整</span>
          </button>
          <button
            onClick={() => {
              if (confirm('確定要登出管理端嗎？')) {
                localStorage.removeItem(ADMIN_PIN_KEY);
                setIsAuthenticated(false);
              }
            }}
            className="p-2 text-red-700 hover:text-red-900 rounded-lg hover:bg-red-50 border border-red-200 text-xs font-semibold flex items-center gap-1 transition"
            title="登出站所管理"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="flex bg-[#e9e4d8] p-1 rounded-xl text-xs font-bold gap-1">
          <button
            onClick={() => setCurrentFilter('to_contact')}
            className={'flex-1 py-2 rounded-lg text-center transition flex items-center justify-center gap-1.5 ' + (
              currentFilter === 'to_contact' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
            )}
          >
            <span>待聯絡</span>
            <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
              currentFilter === 'to_contact' ? 'bg-white/20 text-white' : 'bg-[#fef3c7] text-[#856200]'
            )}>{counts.to_contact}</span>
          </button>
          <button
            onClick={() => setCurrentFilter('processing')}
            className={'flex-1 py-2 rounded-lg text-center transition flex items-center justify-center gap-1.5 ' + (
              currentFilter === 'processing' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
            )}
          >
            <span>處理中</span>
            <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
              currentFilter === 'processing' ? 'bg-white/20 text-white' : 'bg-[#dbeafe] text-[#1e40af]'
            )}>{counts.processing}</span>
          </button>
          <button
            onClick={() => setCurrentFilter('closed')}
            className={'flex-1 py-2 rounded-lg text-center transition flex items-center justify-center gap-1.5 ' + (
              currentFilter === 'closed' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
            )}
          >
            <span>已結案</span>
            <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
              currentFilter === 'closed' ? 'bg-white/20 text-white' : 'bg-[#f3f4f6] text-[#4b5563]'
            )}>{counts.closed}</span>
          </button>
          <button
            onClick={() => setCurrentFilter('all')}
            className={'flex-1 py-2 rounded-lg text-center transition ' + (
              currentFilter === 'all' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
            )}
          >
            全部 ({counts.total})
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-3">
        {loading && requests.length === 0 ? (
          <div className="text-center py-12 text-[#657061] text-sm">載入需求單中...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#e0d9cb]">
            <CheckCircle2 className="w-10 h-10 text-[#bfb8aa] mx-auto mb-2" />
            <div className="text-[#657061] font-bold text-sm">目前沒有此狀態的需求單</div>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              onClick={() => setSelectedReq(req)}
              className="bg-white rounded-2xl border border-[#e0d9cb] p-4 shadow-sm hover:border-[#2a5937] transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs text-[#657061] font-mono">{req.id}</div>
                  <div className="text-base font-bold text-[#20271f] mt-0.5">
                    {req.contact_name} · <span className="text-[#2a5937]">{req.service_type}</span>
                  </div>
                </div>
                {getStatusBadge(req.status)}
              </div>

              <div className="bg-[#faf8f3] rounded-xl p-3 border border-[#f0eae0] text-xs text-[#657061] space-y-1.5 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#20271f]">作物面積：</span>
                  <span>{req.crop_type} · {req.area_size}</span>
                  {req.branch_volume && (
                    <span className="ml-1.5 px-2 py-0.5 bg-[#fef3c7] text-[#856200] rounded font-semibold border border-[#fde68a]">
                      枝條：{req.branch_volume}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#20271f]">希望日期：</span>
                  <span className="text-[#2a5937] font-bold">{req.preferred_date} ({getTimeSlotText(req.preferred_time_slot)})</span>
                  {req.date_flexibility && (
                    <span className="ml-1 text-[#657061] font-normal">
                      · {req.date_flexibility}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#2a5937]" />
                  <span>{req.location_area} {req.location_address}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#f0eae0] flex items-center justify-between">
                <span className="text-[11px] text-[#657061]">
                  {new Date(req.created_at).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 填單
                </span>
                <a
                  href={'tel:' + req.phone}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2a5937] hover:bg-[#173820] text-white text-xs font-bold shadow transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  撥號：{req.phone}
                </a>
              </div>
            </div>
          ))
        )}
      </main>

      {selectedReq && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-y-auto p-5">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#f0eae0] mb-4">
                <div>
                  <span className="text-xs font-mono text-[#657061]">{selectedReq.id}</span>
                  <h3 className="text-lg font-bold text-[#20271f]">{selectedReq.contact_name} 需求詳情</h3>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="p-2 text-[#657061] hover:text-[#20271f] rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#faf8f3] rounded-xl p-4 space-y-2.5 text-sm mb-5 border border-[#e0d9cb]">
                <div className="flex justify-between">
                  <span className="text-[#657061]">電話</span>
                  <a href={'tel:' + selectedReq.phone} className="font-bold text-[#2a5937] underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {selectedReq.phone}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">服務項目</span>
                  <span className="font-bold text-[#20271f]">{selectedReq.service_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">作物種類</span>
                  <span className="text-[#20271f]">{selectedReq.crop_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">預估面積</span>
                  <span className="text-[#20271f]">{selectedReq.area_size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">枝條數量</span>
                  <span className="font-bold text-[#2a5937]">{selectedReq.branch_volume || '未填寫'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">希望日期</span>
                  <span className="font-bold text-[#2a5937]">{selectedReq.preferred_date} ({getTimeSlotText(selectedReq.preferred_time_slot)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">日期彈性</span>
                  <span className="font-semibold text-[#20271f]">{selectedReq.date_flexibility || '未特別註明'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#657061]">施作地點</span>
                  <span className="text-[#20271f] text-right">{selectedReq.location_area} {selectedReq.location_address}</span>
                </div>
                {selectedReq.notes && (
                  <div className="pt-2 border-t border-[#e0d9cb]">
                    <span className="text-[#657061] block mb-1">農友備註：</span>
                    <p className="text-[#20271f] bg-white p-2 rounded-lg border border-[#d8d1c3] text-xs">{selectedReq.notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <label className="text-xs font-bold text-[#20271f] block">處理狀態標記</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['to_contact', 'processing', 'closed'] as RequestStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(selectedReq.id, st, selectedReq.admin_memo)}
                      disabled={savingStatus}
                      className={'py-2 text-xs font-bold rounded-lg border transition ' + (
                        selectedReq.status === st
                          ? st === 'to_contact'
                            ? 'bg-[#fef3c7] border-[#fde68a] text-[#856200]'
                            : st === 'processing'
                            ? 'bg-[#dbeafe] border-[#bfdbfe] text-[#1e40af]'
                            : 'bg-[#f3f4f6] border-[#e5e7eb] text-[#4b5563]'
                          : 'border-[#d8d1c3] text-[#657061] hover:bg-[#faf8f3]'
                      )}
                    >
                      {st === 'to_contact' ? '待聯絡' : st === 'processing' ? '處理中' : '已結案'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#20271f] block mb-1">站所內部備註 (僅站所可見)</label>
                <textarea
                  defaultValue={selectedReq.admin_memo || ''}
                  onBlur={(e) => handleUpdateStatus(selectedReq.id, selectedReq.status, e.target.value)}
                  placeholder="紀錄電話聯絡細節、確認施工時間或農友回覆..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none bg-white text-[#20271f]"
                />
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-[#e0d9cb]">
              <a
                href={'tel:' + selectedReq.phone}
                className="w-full py-3.5 bg-[#2a5937] hover:bg-[#173820] text-white font-bold text-center rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#2a5937]/20"
              >
                <Phone className="w-5 h-5" />
                立即撥電話給 {selectedReq.contact_name}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
