import React, { useState, useEffect } from 'react';
import liff from '@line/liff';
import { ServiceRequest, RequestStatus, AvailabilityRule, AvailabilityException } from '../../../shared/types';
import { Phone, CheckCircle2, RefreshCw, X, MapPin, LogOut, Loader2, ShieldCheck, ShieldAlert, Calendar, Clock, AlertTriangle, Settings, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '';
const ADMIN_TOKEN_KEY = 'open_booking_admin_token';
const STATION_NAME = (import.meta.env.VITE_STATION_NAME as string) || '預約服務站';

const START_TIME_OPTIONS = {
  morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  afternoon: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
};

interface AdminUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<AdminUserProfile | null>(null);
  const [authError, setAuthError] = useState<{ message: string; userId?: string; displayName?: string } | null>(null);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<ServiceRequest | null>(null);
  const [currentFilter, setCurrentFilter] = useState<RequestStatus | 'all'>('to_contact');
  const [counts, setCounts] = useState({ to_contact: 0, confirmed: 0, processing: 0, closed: 0, cancelled: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 確認排程表單狀態
  const [confirmDate, setConfirmDate] = useState('');
  const [confirmSlot, setConfirmSlot] = useState<'morning' | 'afternoon'>('morning');
  const [confirmTime, setConfirmTime] = useState('08:00');
  const [confirmNotice, setConfirmNotice] = useState('');

  // 頁籤導覽模式：requests (預約管理) | settings (時段與公休設定)
  const [activeTab, setActiveTab] = useState<'requests' | 'settings'>('requests');

  // Ep03-5 時段規則與公休設定狀態
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [config, setConfig] = useState<{ mode: 'legacy' | 'managed'; lead_time_days: number; booking_horizon_days: number }>({
    mode: 'legacy',
    lead_time_days: 1,
    booking_horizon_days: 30
  });
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  
  // 新增例外公休表單
  const [exDate, setExDate] = useState('');
  const [exSlot, setExSlot] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [exReason, setExReason] = useState('');
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<{ count: number; conflicts: any[]; warning: string } | null>(null);

  // 改期表單狀態
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState<'morning' | 'afternoon'>('morning');
  const [rescheduleTime, setRescheduleTime] = useState('08:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleNotice, setRescheduleNotice] = useState('');

  // 當 selectedReq 改變時，初始化排程表單預設值
  useEffect(() => {
    if (selectedReq) {
      const defaultSlot = selectedReq.preferred_time_slot === 'afternoon' ? 'afternoon' : 'morning';
      setConfirmDate(selectedReq.preferred_date || '');
      setConfirmSlot(defaultSlot);
      setConfirmTime(defaultSlot === 'morning' ? '08:00' : '13:00');
      setConfirmNotice(selectedReq.customer_notice || '');

      setRescheduleDate(selectedReq.scheduled_date || selectedReq.preferred_date || '');
      const curSlot = selectedReq.scheduled_slot_code || defaultSlot;
      setRescheduleSlot(curSlot);
      setRescheduleTime(selectedReq.scheduled_start_time || (curSlot === 'morning' ? '08:00' : '13:00'));
      setRescheduleReason('');
      setRescheduleNotice(selectedReq.customer_notice || '');
      setShowRescheduleModal(false);
    }
  }, [selectedReq]);

  const authenticateWithIdToken = async (idToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, idToken);
        setAdminUser(data.user);
        setIsAuthenticated(true);
        setAuthError(null);
        return true;
      } else if (res.status === 403 && data) {
        setAuthError({
          message: data.message || '您非授權管理人員',
          userId: data.userId,
          displayName: data.displayName
        });
        return false;
      } else {
        const errorMsg = data?.message || `驗證失敗 (HTTP ${res.status})`;
        console.warn('Admin auth failed:', errorMsg);
        return false;
      }
    } catch (err: any) {
      console.error('LINE admin auth error:', err);
      return false;
    }
  };

  // 1. 初始化 LIFF 與 LINE 幹部白名單自動驗證
  useEffect(() => {
    if (!LIFF_ID) {
      console.warn('VITE_LIFF_ID is not configured');
      setIsCheckingAuth(false);
      return;
    }

    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (liff.isLoggedIn()) {
          const idToken = liff.getIDToken();
          if (idToken) {
            await authenticateWithIdToken(idToken);
          }
        }
        setIsCheckingAuth(false);
      })
      .catch((err) => {
        console.warn('LIFF init warning:', err);
        setIsCheckingAuth(false);
      });
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    let lineToken = '';
    if (LIFF_ID) {
      try {
        if (liff.isLoggedIn()) {
          lineToken = liff.getIDToken() || '';
        }
      } catch {}
    }
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || lineToken;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = currentFilter === 'all' 
        ? `${API_BASE}/api/admin/requests` 
        : `${API_BASE}/api/admin/requests?status=${currentFilter}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setLoading(false);
    }
  };

  // Ep03-5 載入可用性設定 (每週規則、例外封鎖、全域參數)
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/availability-settings`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.data.config);
        
        // 若伺服器回傳的 rules 為空，建立預設週一至週日 (0~6) 上下午全開的 14 筆規則陣列
        let ruleList: AvailabilityRule[] = data.data.rules || [];
        if (ruleList.length === 0) {
          const defaultRules: AvailabilityRule[] = [];
          for (let d = 0; d < 7; d++) {
            defaultRules.push({ id: `rule_${d}_morning`, day_of_week: d, slot_code: 'morning', is_enabled: 1, updated_at: '' });
            defaultRules.push({ id: `rule_${d}_afternoon`, day_of_week: d, slot_code: 'afternoon', is_enabled: 1, updated_at: '' });
          }
          ruleList = defaultRules;
        } else if (ruleList.length < 14) {
          // 確保 14 個時段皆有對應項目
          const map = new Map<string, AvailabilityRule>();
          for (const r of ruleList) map.set(`${r.day_of_week}_${r.slot_code}`, r);
          const fullRules: AvailabilityRule[] = [];
          for (let d = 0; d < 7; d++) {
            for (const s of ['morning', 'afternoon'] as const) {
              const existing = map.get(`${d}_${s}`);
              fullRules.push(existing || { id: `rule_${d}_${s}`, day_of_week: d, slot_code: s, is_enabled: 1, updated_at: '' });
            }
          }
          ruleList = fullRules;
        }
        setRules(ruleList);
        setExceptions(data.data.exceptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch availability settings', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'requests') {
        fetchRequests();
      } else if (activeTab === 'settings') {
        fetchSettings();
      }
    }
  }, [currentFilter, isAuthenticated, activeTab]);

  // 切換特定星期特定時段的開放狀態
  const handleToggleRule = (day: number, slot: 'morning' | 'afternoon') => {
    setRules(prev =>
      prev.map(r =>
        r.day_of_week === day && r.slot_code === slot
          ? { ...r, is_enabled: r.is_enabled === 1 ? 0 : 1 }
          : r
      )
    );
  };

  // 儲存每週規則與切換為 Managed 模式 (Case U)
  const handleSaveRules = async () => {
    const anyEnabled = rules.some(r => r.is_enabled === 1);
    if (!anyEnabled) {
      alert('⚠️ 不得關閉所有時段！每週至少需保留一個開放營業時段。');
      return;
    }

    if (config.mode === 'legacy') {
      const confirmed = window.confirm(
        '【切換模式確認】\n目前系統處於相容模式 (Legacy)，儲存自訂規則後將正式切換為管制模式 (Managed)。\n是否確認儲存並啟用？'
      );
      if (!confirmed) return;
    }

    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/availability-rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          rules: rules.map(r => ({ day_of_week: r.day_of_week, slot_code: r.slot_code, is_enabled: r.is_enabled })),
          lead_time_days: config.lead_time_days,
          booking_horizon_days: config.booking_horizon_days
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 每週時段規則已成功儲存！系統已運行於 Managed 管制模式。');
        fetchSettings();
      } else {
        alert('❌ 儲存失敗：' + (data.message || '未知錯誤'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setSettingsSaving(false);
    }
  };

  // 檢查新增例外公休是否與既有 active 預約衝突 (Case L)
  const handleCheckConflict = async (date: string, slot: 'all' | 'morning' | 'afternoon') => {
    if (!date) {
      setConflictWarning(null);
      return;
    }
    setCheckingConflict(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/availability-exceptions/check-conflict?date=${date}&slot_code=${slot}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success && data.has_conflict) {
        setConflictWarning({
          count: data.conflict_count,
          conflicts: data.conflicts,
          warning: data.warning
        });
      } else {
        setConflictWarning(null);
      }
    } catch (err) {
      console.error('Failed to check conflict', err);
    } finally {
      setCheckingConflict(false);
    }
  };

  // 當例外日期或時段更動時觸發衝突即時查核
  const handleExDateChange = (date: string) => {
    setExDate(date);
    if (date) {
      handleCheckConflict(date, exSlot);
    } else {
      setConflictWarning(null);
    }
  };

  const handleExSlotChange = (slot: 'all' | 'morning' | 'afternoon') => {
    setExSlot(slot);
    if (exDate) {
      handleCheckConflict(exDate, slot);
    }
  };

  // 提交新增公休例外
  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exDate) {
      alert('請選擇公休日期');
      return;
    }

    if (conflictWarning && conflictWarning.count > 0) {
      const proceed = window.confirm(
        `⚠️ 衝突提醒：\n該時段已有 ${conflictWarning.count} 筆農友的預約！\n新增公休不會自動取消該筆預約，但農友端將不可再預約。\n確定要繼續新增公休嗎？`
      );
      if (!proceed) return;
    }

    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/availability-exceptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          exception_date: exDate,
          slot_code: exSlot,
          reason: exReason || '服務站公休暫停服務'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 公休時段已設定！');
        setExDate('');
        setExReason('');
        setConflictWarning(null);
        fetchSettings();
      } else {
        alert('❌ 設定失敗：' + (data.message || '未知錯誤'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setSettingsSaving(false);
    }
  };

  // 刪除公休例外
  const handleDeleteException = async (id: string, date: string) => {
    if (!window.confirm(`確定要解除 ${date} 的公休封鎖嗎？`)) return;
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/availability-exceptions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 已解除該公休封鎖！');
        fetchSettings();
      } else {
        alert('❌ 解除失敗：' + (data.message || '未知錯誤'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setSettingsSaving(false);
    }
  };

  // 更新內部管理備註 (通用 PATCH 僅限 memo)
  const handleUpdateMemo = async (id: string, memo: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ admin_memo: memo })
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, admin_memo: memo } : r));
      if (selectedReq && selectedReq.id === id) {
        setSelectedReq({ ...selectedReq, admin_memo: memo });
      }
    } catch (err) {
      console.error('Failed to update memo', err);
    }
  };

  // 3.1 執行確認排程
  const handleConfirmSchedule = async (id: string) => {
    if (!confirmDate) {
      alert('請選擇正式服務日期');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          booking_date: confirmDate,
          slot_code: confirmSlot,
          scheduled_start_time: confirmTime,
          admin_memo: selectedReq?.admin_memo,
          customer_notice: confirmNotice.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 排程已成功確認！');
        setSelectedReq(null);
        fetchRequests();
      } else {
        alert('❌ 確認失敗：' + (data.message || '時段衝突或無效操作'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // 3.2 標記開始施工
  const handleStartWork = async (id: string) => {
    if (!confirm('確定要將此案件標記為「施工處理中」嗎？')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/start-work`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ admin_memo: selectedReq?.admin_memo })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 已變更為施工處理中！');
        setSelectedReq(null);
        fetchRequests();
      } else {
        alert('❌ 操作失敗：' + (data.message || '伺服器錯誤'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // 3.3 施工完成結案
  const handleComplete = async (id: string) => {
    if (!confirm('確定此案件已施工完成並結案嗎？')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ admin_memo: selectedReq?.admin_memo })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 案件已結案！');
        setSelectedReq(null);
        fetchRequests();
      } else {
        alert('❌ 操作失敗：' + (data.message || '伺服器錯誤'));
      }
    } catch (err: any) {
      alert('請求異常：' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // 3.4 執行改期
  const handleReschedule = async (id: string) => {
    if (!rescheduleDate) {
      alert('請選擇改期日期');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          booking_date: rescheduleDate,
          slot_code: rescheduleSlot,
          scheduled_start_time: rescheduleTime,
          reason: rescheduleReason,
          customer_notice: rescheduleNotice.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 改期成功！已更新正式排程。');
        setShowRescheduleModal(false);
        setSelectedReq(null);
        fetchRequests();
      } else {
        alert('❌ 改期失敗：' + (data.message || '時段衝突'));
      }
    } catch (err: any) {
      alert('改期異常：' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // 3.5 取消案件
  const handleCancel = async (id: string) => {
    const reason = prompt('請輸入取消原因（將釋放該時段）：');
    if (reason === null) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('✅ 案件已取消，時段已成功釋放！');
        setSelectedReq(null);
        fetchRequests();
      } else {
        alert('❌ 取消失敗：' + (data.message || '伺服器錯誤'));
      }
    } catch (err: any) {
      alert('取消異常：' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'to_contact':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef3c7] text-[#856200] border border-[#fde68a]">待聯絡</span>;
      case 'confirmed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]">已確認排程</span>;
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe]">處理中</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">已結案</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]">已取消</span>;
    }
  };

  const getTimeSlotText = (slot: string) => {
    if (slot === 'morning') return '上午';
    if (slot === 'afternoon') return '下午';
    return '皆可';
  };

  const handleLineLogin = async () => {
    if (!LIFF_ID) {
      alert('系統尚未設定 VITE_LIFF_ID，請先於環境變數中設定。');
      return;
    }

    setIsCheckingAuth(true);
    try {
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      // 已在 LINE 內或已登入狀態：主動提取 ID Token 進行身分驗證
      const idToken = liff.getIDToken();
      if (!idToken) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const success = await authenticateWithIdToken(idToken);
      if (!success && !authError) {
        alert('身分驗證未通過：無法確認服務人員權限，請確認您的 LINE 帳號已加入 ADMIN_LINE_IDS 白名單。');
      }
    } catch (err: any) {
      alert('登入驗證異常：' + (err?.message || err));
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogout = () => {
    if (confirm('確定要登出管理端嗎？')) {
      if (LIFF_ID) {
        try {
          if (liff.isLoggedIn()) {
            liff.logout();
          }
        } catch {}
      }
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      setIsAuthenticated(false);
      setAdminUser(null);
      setAuthError(null);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-[#657061] font-semibold">
          <Loader2 className="w-5 h-5 animate-spin text-[#2a5937]" />
          <span>正在進行服務人員身分驗證...</span>
        </div>
      </div>
    );
  }

  // 非授權服務人員錯誤提示畫面 (403 Forbidden)
  if (authError) {
    return (
      <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center p-4">
        <div className="bg-[#fffdf7] max-w-sm w-full rounded-2xl shadow-xl border border-red-200 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#20271f] mb-1">未獲服務人員授權</h2>
          <p className="text-xs text-red-600 font-semibold mb-4">
            {authError.message}
          </p>
          <div className="bg-[#f8f3e7] border border-[#e0d9cb] rounded-xl p-3 text-left text-xs text-[#657061] mb-6 space-y-1 font-mono">
            {authError.displayName && <div>• LINE 暱稱：{authError.displayName}</div>}
            {authError.userId && <div className="break-all">• LINE ID：{authError.userId}</div>}
            <div className="text-[11px] text-[#2a5937] pt-1">
              若您為站所服務人員，請聯繫系統管理員將您的 LINE ID 加入授權名單。
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                if (LIFF_ID) {
                  try {
                    if (liff.isLoggedIn()) liff.logout();
                  } catch {}
                }
                setAuthError(null);
              }}
              className="w-full py-2.5 bg-[#eee2cf] hover:bg-[#e2d4bd] text-[#20271f] font-semibold rounded-xl text-xs transition"
            >
              切換其他 LINE 帳號
            </button>
            <a
              href="/"
              className="block w-full py-2.5 text-center text-xs text-[#657061] hover:text-[#20271f] font-medium"
            >
              ← 返回農友預約表單
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center p-4">
        <div className="bg-[#fffdf7] max-w-sm w-full rounded-2xl shadow-xl border border-[#c8ad86] p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-[#dcebd6] text-[#173820] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#c8ad86]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#20271f] mb-1">服務站管理系統</h2>
          <p className="text-xs text-[#657061] mb-6">
            限授權服務人員存取 · 零密碼身分安全保護
          </p>

          {/* 主要登入：LINE 服務人員一鍵授權登入 */}
          <button
            onClick={handleLineLogin}
            className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm mb-3"
          >
            <span className="text-lg">💬</span>
            <span>使用 LINE 帳號授權登入</span>
          </button>
          <p className="text-[11px] text-[#657061] mb-6 leading-relaxed">
            手機開啟將自動鑑權；電腦開啟可使用手機 LINE 掃描 QR Code 快速登入
          </p>

          <div className="pt-4 border-t border-[#e0d9cb]">
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
            <span className="text-xs font-bold text-[#657061]">{STATION_NAME}</span>
            {adminUser && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e8f3e5] text-[#2a5937] border border-[#c5e3bd]">
                {adminUser.pictureUrl && (
                  <img src={adminUser.pictureUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                )}
                <span>服務人員：{adminUser.displayName}</span>
              </span>
            )}
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
            onClick={handleLogout}
            className="p-2 text-red-700 hover:text-red-900 rounded-lg hover:bg-red-50 border border-red-200 text-xs font-semibold flex items-center gap-1 transition"
            title="登出站所管理"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      </header>

      {/* 頂層頁籤切換：預約案件管理 vs 時段與公休設定 */}
      <div className="max-w-4xl mx-auto px-4 mt-3">
        <div className="flex border-b border-[#ded7c8] gap-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={'pb-2.5 text-sm font-bold flex items-center gap-1.5 border-b-2 transition ' + (
              activeTab === 'requests'
                ? 'border-[#173820] text-[#173820]'
                : 'border-transparent text-[#657061] hover:text-[#20271f]'
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>申請單管理</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={'pb-2.5 text-sm font-bold flex items-center gap-1.5 border-b-2 transition ' + (
              activeTab === 'settings'
                ? 'border-[#173820] text-[#173820]'
                : 'border-transparent text-[#657061] hover:text-[#20271f]'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>時段規則與公休設定</span>
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <>
          <div className="max-w-4xl mx-auto px-4 mt-4">
            <div className="flex bg-[#e9e4d8] p-1 rounded-xl text-xs font-bold gap-1 overflow-x-auto">
              <button
                onClick={() => setCurrentFilter('to_contact')}
                className={'flex-1 min-w-[70px] py-2 rounded-lg text-center transition flex items-center justify-center gap-1 ' + (
                  currentFilter === 'to_contact' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
                )}
              >
                <span>待聯絡</span>
                <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
                  currentFilter === 'to_contact' ? 'bg-white/20 text-white' : 'bg-[#fef3c7] text-[#856200]'
                )}>{counts.to_contact}</span>
              </button>
              <button
                onClick={() => setCurrentFilter('confirmed')}
                className={'flex-1 min-w-[80px] py-2 rounded-lg text-center transition flex items-center justify-center gap-1 ' + (
                  currentFilter === 'confirmed' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
                )}
              >
                <span>已確認</span>
                <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
                  currentFilter === 'confirmed' ? 'bg-white/20 text-white' : 'bg-[#dcfce7] text-[#15803d]'
                )}>{counts.confirmed}</span>
              </button>
              <button
                onClick={() => setCurrentFilter('processing')}
                className={'flex-1 min-w-[70px] py-2 rounded-lg text-center transition flex items-center justify-center gap-1 ' + (
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
                className={'flex-1 min-w-[70px] py-2 rounded-lg text-center transition flex items-center justify-center gap-1 ' + (
                  currentFilter === 'closed' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
                )}
              >
                <span>已結案</span>
                <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
                  currentFilter === 'closed' ? 'bg-white/20 text-white' : 'bg-[#f3f4f6] text-[#4b5563]'
                )}>{counts.closed}</span>
              </button>
              <button
                onClick={() => setCurrentFilter('cancelled')}
                className={'flex-1 min-w-[70px] py-2 rounded-lg text-center transition flex items-center justify-center gap-1 ' + (
                  currentFilter === 'cancelled' ? 'bg-[#173820] text-white shadow-sm' : 'text-[#657061] hover:text-[#20271f]'
                )}
              >
                <span>已取消</span>
                <span className={'px-1.5 py-0.2 rounded-full text-[10px] ' + (
                  currentFilter === 'cancelled' ? 'bg-white/20 text-white' : 'bg-[#fee2e2] text-[#b91c1c]'
                )}>{counts.cancelled}</span>
              </button>
              <button
                onClick={() => setCurrentFilter('all')}
                className={'flex-1 min-w-[70px] py-2 rounded-lg text-center transition ' + (
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

                    {/* 正式排程資訊 (若有) */}
                    {req.scheduled_date ? (
                      <div className="flex items-center gap-1.5 bg-[#ecfdf5] p-1.5 rounded-lg border border-[#a7f3d0]">
                        <span className="font-bold text-[#065f46]">正式排程：</span>
                        <span className="text-[#047857] font-black">
                          {req.scheduled_date} ({getTimeSlotText(req.scheduled_slot_code || '')}) {req.scheduled_start_time} 開工
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#20271f]">希望日期：</span>
                        <span className="text-[#2a5937] font-bold">{req.preferred_date} ({getTimeSlotText(req.preferred_time_slot)})</span>
                        {req.date_flexibility && (
                          <span className="ml-1 text-[#657061] font-normal">
                            · {req.date_flexibility}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#2a5937]" />
                      <span>{req.location_area} {req.location_address}</span>
                    </div>

                    {req.customer_notice && (
                      <div className="flex items-start gap-1.5 bg-[#fefce8] p-1.5 rounded-lg border border-[#fde047] text-[#854d0e]">
                        <span className="font-bold shrink-0">📢 叮嚀：</span>
                        <span className="text-[11px] truncate">{req.customer_notice}</span>
                      </div>
                    )}
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
        </>
      ) : (
        /* Ep03-5 時段規則與公休設定頁面 */
        <main className="max-w-4xl mx-auto px-4 mt-4 space-y-6">
          {settingsLoading ? (
            <div className="text-center py-12 text-[#657061] text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#2a5937]" />
              <span>載入站所可用性設定中...</span>
            </div>
          ) : (
            <>
              {/* 卡片 1：系統排程模式與全域參數 */}
              <div className="bg-white rounded-2xl border border-[#e0d9cb] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#f0eae0] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#173820] flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#2a5937]" />
                      <span>排程引擎模式與預約窗口</span>
                    </h2>
                    <p className="text-xs text-[#657061] mt-0.5">控制前台農友預約時段開放機制與天數計算</p>
                  </div>
                  <div>
                    {config.mode === 'managed' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] border border-[#86efac]">
                        ● 管制模式 (Managed)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#fef3c7] text-[#856200] border border-[#fde68a]">
                        ● 相容模式 (Legacy)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#faf8f3] p-3 rounded-xl border border-[#e0d9cb]">
                    <div className="font-bold text-[#20271f] mb-1">最少提前預約天數 (Lead Time)</div>
                    <div className="text-[#657061] mb-2 leading-relaxed">
                      農友最快可預約 <span className="font-bold text-[#173820]">T+{config.lead_time_days}</span>（例如：今天下單，最快明天開始施作）。
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        value={config.lead_time_days}
                        onChange={(e) => setConfig({ ...config, lead_time_days: parseInt(e.target.value, 10) || 0 })}
                        className="w-20 p-1.5 border border-[#bfb8aa] rounded-lg text-xs"
                      />
                      <span className="text-[#657061]">天</span>
                    </div>
                  </div>

                  <div className="bg-[#faf8f3] p-3 rounded-xl border border-[#e0d9cb]">
                    <div className="font-bold text-[#20271f] mb-1">最遠開放預約天數 (Horizon)</div>
                    <div className="text-[#657061] mb-2 leading-relaxed">
                      農友最遠可預約 <span className="font-bold text-[#173820]">T+{config.booking_horizon_days}</span>（預設為 30 天內）。
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="7"
                        max="90"
                        value={config.booking_horizon_days}
                        onChange={(e) => setConfig({ ...config, booking_horizon_days: parseInt(e.target.value, 10) || 30 })}
                        className="w-20 p-1.5 border border-[#bfb8aa] rounded-lg text-xs"
                      />
                      <span className="text-[#657061]">天</span>
                    </div>
                  </div>
                </div>

                {config.mode === 'legacy' && (
                  <div className="bg-[#fefce8] p-3 rounded-xl border border-[#fef08a] flex items-start gap-2 text-xs text-[#854d0e]">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-[#ca8a04] mt-0.5" />
                    <div>
                      <span className="font-bold">目前系統處於相容模式 (Legacy)：</span>
                      <span> 只要日期非公休，預設週一至週日全時段皆開放。儲存下方的每週規則後，系統將自動平滑切換至「管制模式 (Managed)」，嚴格遵循您自訂的每週營業矩陣。</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 卡片 2：每週固定營業時段矩陣 (週一至週日 上午/下午) */}
              <div className="bg-white rounded-2xl border border-[#e0d9cb] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#f0eae0] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#173820] flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#2a5937]" />
                      <span>每週固定開放時段矩陣 (14 區間)</span>
                    </h2>
                    <p className="text-xs text-[#657061] mt-0.5">勾選開放營運的常態時段；取消勾選則該時段在前台顯示為停用</p>
                  </div>
                  <button
                    onClick={handleSaveRules}
                    disabled={settingsSaving}
                    className="px-4 py-2 bg-[#2a5937] hover:bg-[#173820] text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {settingsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>儲存每週規則</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f5f2ea] text-[#20271f] font-bold border-b border-[#e0d9cb]">
                        <th className="p-3 w-28">星期</th>
                        <th className="p-3">上午時段 (08:00 ~ 11:30)</th>
                        <th className="p-3">下午時段 (13:00 ~ 17:00)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eee9dc]">
                      {[
                        { d: 1, label: '週一 (Mon)' },
                        { d: 2, label: '週二 (Tue)' },
                        { d: 3, label: '週三 (Wed)' },
                        { d: 4, label: '週四 (Thu)' },
                        { d: 5, label: '週五 (Fri)' },
                        { d: 6, label: '週六 (Sat)' },
                        { d: 0, label: '週日 (Sun)' }
                      ].map(({ d, label }) => {
                        const morningRule = rules.find(r => r.day_of_week === d && r.slot_code === 'morning');
                        const afternoonRule = rules.find(r => r.day_of_week === d && r.slot_code === 'afternoon');
                        const morningEnabled = morningRule ? morningRule.is_enabled === 1 : true;
                        const afternoonEnabled = afternoonRule ? afternoonRule.is_enabled === 1 : true;

                        return (
                          <tr key={d} className="hover:bg-[#faf8f3] transition">
                            <td className="p-3 font-bold text-[#20271f]">{label}</td>
                            <td className="p-3">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={morningEnabled}
                                  onChange={() => handleToggleRule(d, 'morning')}
                                  className="w-4 h-4 rounded text-[#2a5937] focus:ring-[#2a5937] border-[#bfb8aa]"
                                />
                                <span className={morningEnabled ? 'font-bold text-[#15803d]' : 'text-[#9ca3af] line-through'}>
                                  {morningEnabled ? '開放服務' : '休息停用'}
                                </span>
                              </label>
                            </td>
                            <td className="p-3">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={afternoonEnabled}
                                  onChange={() => handleToggleRule(d, 'afternoon')}
                                  className="w-4 h-4 rounded text-[#2a5937] focus:ring-[#2a5937] border-[#bfb8aa]"
                                />
                                <span className={afternoonEnabled ? 'font-bold text-[#15803d]' : 'text-[#9ca3af] line-through'}>
                                  {afternoonEnabled ? '開放服務' : '休息停用'}
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 卡片 3：特定日期公休例外維護 (含衝突檢查，Case L) */}
              <div className="bg-white rounded-2xl border border-[#e0d9cb] p-5 shadow-sm space-y-4">
                <div className="border-b border-[#f0eae0] pb-3">
                  <h2 className="text-base font-bold text-[#173820] flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#2a5937]" />
                    <span>特定日期公休例外封鎖 (Exceptions)</span>
                  </h2>
                  <p className="text-xs text-[#657061] mt-0.5">設定農忙國定假日或站所盤點；若該日期已有排程，系統將發出提醒且不損壞既有預約</p>
                </div>

                {/* 新增公休表單 */}
                <form onSubmit={handleAddException} className="bg-[#faf8f3] p-4 rounded-xl border border-[#e0d9cb] space-y-3">
                  <div className="text-xs font-bold text-[#20271f] flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#2a5937]" />
                    <span>新增公休封鎖日期</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-[#374151] block mb-1">公休日期</label>
                      <input
                        type="date"
                        value={exDate}
                        onChange={(e) => handleExDateChange(e.target.value)}
                        className="w-full p-2 border border-[#bfb8aa] rounded-lg bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#374151] block mb-1">封鎖時段</label>
                      <select
                        value={exSlot}
                        onChange={(e) => handleExSlotChange(e.target.value as any)}
                        className="w-full p-2 border border-[#bfb8aa] rounded-lg bg-white"
                      >
                        <option value="all">全天封鎖 (All Day)</option>
                        <option value="morning">僅上午 (Morning)</option>
                        <option value="afternoon">僅下午 (Afternoon)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-[#374151] block mb-1">原因說明 (選填)</label>
                      <input
                        type="text"
                        placeholder="例：站所年度盤點、國定假日"
                        value={exReason}
                        onChange={(e) => setExReason(e.target.value)}
                        className="w-full p-2 border border-[#bfb8aa] rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  {/* 即時衝突檢查反饋 (Case L) */}
                  {checkingConflict && (
                    <div className="text-xs text-[#657061] flex items-center gap-1.5 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2a5937]" />
                      <span>正在檢查目標日期排程衝突狀況...</span>
                    </div>
                  )}

                  {conflictWarning && (
                    <div className="bg-[#fffbeb] border border-[#fde68a] p-3 rounded-xl text-xs space-y-2">
                      <div className="flex items-start gap-2 text-[#b45309]">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">⚠️ 時段衝突警示 (Case L 保護機制)</div>
                          <div className="leading-relaxed mt-0.5">{conflictWarning.warning}</div>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-lg p-2 border border-[#fef3c7] space-y-1">
                        <div className="font-bold text-[#92400e] text-[11px]">受影響既有預約清單 ({conflictWarning.count} 筆)：</div>
                        {conflictWarning.conflicts.map((c: any) => (
                          <div key={c.reservation_id} className="text-[11px] text-[#4b5563] flex justify-between">
                            <span>• {c.contact_name} ({c.phone}) - {c.service_type}</span>
                            <span className="font-mono text-[#065f46] font-bold">{c.scheduled_start_time} ({getTimeSlotText(c.slot_code)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={settingsSaving || !exDate}
                      className="px-4 py-2 bg-[#2a5937] hover:bg-[#173820] text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {settingsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>確認新增封鎖</span>
                    </button>
                  </div>
                </form>

                {/* 現有公休例外清單 */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#20271f]">現有公休封鎖清單 ({exceptions.length} 筆)</div>
                  {exceptions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#9ca3af] bg-[#faf8f3] rounded-xl border border-dashed border-[#e0d9cb]">
                      目前無任何特定公休例外
                    </div>
                  ) : (
                    <div className="divide-y divide-[#eee9dc] border border-[#e0d9cb] rounded-xl overflow-hidden bg-white">
                      {exceptions.map((ex) => (
                        <div key={ex.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#faf8f3] transition">
                          <div>
                            <div className="font-bold text-[#20271f] flex items-center gap-2">
                              <span>{ex.exception_date}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]">
                                {ex.slot_code === 'all' ? '全天封鎖' : ex.slot_code === 'morning' ? '上午封鎖' : '下午封鎖'}
                              </span>
                            </div>
                            <div className="text-[#657061] mt-0.5 text-[11px]">
                              原因：{ex.reason || '服務站暫停服務'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteException(ex.id, ex.exception_date)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200 transition"
                            title="解除封鎖"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      )}

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

              {/* 核心排程確認與生命週期管理區塊 (Ep03) */}
              <div className="mb-4">
                {selectedReq.status === 'to_contact' || (selectedReq.status === 'processing' && !selectedReq.scheduled_date) ? (
                  /* 1. 待聯絡或舊 processing 補建排程確認表單 */
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#166534]">
                      <Calendar className="w-4 h-4 text-[#16a34a]" />
                      <span>電話確認與排程設定</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#374151] block mb-1">正式服務日期</label>
                      <input
                        type="date"
                        value={confirmDate}
                        onChange={(e) => setConfirmDate(e.target.value)}
                        className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-[#374151] block mb-1">正式時段</label>
                        <select
                          value={confirmSlot}
                          onChange={(e) => {
                            const newSlot = e.target.value as 'morning' | 'afternoon';
                            setConfirmSlot(newSlot);
                            setConfirmTime(newSlot === 'morning' ? '08:00' : '13:00');
                          }}
                          className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg bg-white"
                        >
                          <option value="morning">上午 (08:00~11:30)</option>
                          <option value="afternoon">下午 (13:00~17:00)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#374151] block mb-1">預定開工時間</label>
                        <select
                          value={confirmTime}
                          onChange={(e) => setConfirmTime(e.target.value)}
                          className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg bg-white font-mono"
                        >
                          {START_TIME_OPTIONS[confirmSlot].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#374151] block mb-1">
                          📢 提醒農友注意事項 / 施工叮嚀 (選填，將顯示於 LINE 卡片)
                        </label>
                        <textarea
                          rows={2}
                          value={confirmNotice}
                          onChange={(e) => setConfirmNotice(e.target.value)}
                          placeholder="例：若遇雨天順延；現場需備妥 220V 電源與水源..."
                          className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg bg-white resize-none text-[#1f2937]"
                        />
                      </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleConfirmSchedule(selectedReq.id)}
                      className="w-full py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>確認排程 (建立正式預約)</span>
                    </button>
                  </div>
                ) : selectedReq.status === 'confirmed' ? (
                  /* 2. 已確認狀態之操作 (開始施工、改期、取消) */
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold text-[#334155] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#0284c7]" />
                        <span>正式排程已鎖定</span>
                      </span>
                      <span className="text-[#047857] font-mono text-[11px] font-bold">
                        {selectedReq.scheduled_date} {selectedReq.scheduled_start_time}
                      </span>
                    </div>

                    {selectedReq.customer_notice && (
                      <div className="bg-[#fefce8] border border-[#fde047] rounded-lg p-2.5 text-xs text-[#713f12]">
                        <span className="font-bold">📢 農友提醒事項：</span>
                        <p className="mt-0.5 whitespace-pre-wrap">{selectedReq.customer_notice}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStartWork(selectedReq.id)}
                        className="py-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        🚜 開始施工
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowRescheduleModal(true)}
                        className="py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        📅 變更排程
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleCancel(selectedReq.id)}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition"
                    >
                      取消預約 (釋放時段)
                    </button>
                  </div>
                ) : selectedReq.status === 'processing' ? (
                  /* 3. 處理中狀態之操作 (結案、取消) */
                  <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold text-[#1e40af] flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563eb]" />
                      <span>施工處理中</span>
                    </div>

                    {selectedReq.customer_notice && (
                      <div className="bg-[#fefce8] border border-[#fde047] rounded-lg p-2.5 text-xs text-[#713f12]">
                        <span className="font-bold">📢 農友提醒事項：</span>
                        <p className="mt-0.5 whitespace-pre-wrap">{selectedReq.customer_notice}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleComplete(selectedReq.id)}
                        className="py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        ✅ 完工結案
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleCancel(selectedReq.id)}
                        className="py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition"
                      >
                        中途取消
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 4. 結案或取消終態提示 */
                  <div className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl p-3 text-xs text-[#64748b] text-center font-semibold">
                    案件已處於終態 ({selectedReq.status === 'closed' ? '已結案' : '已取消'})，排程已歸檔。
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#20271f] block mb-1">站所內部備註 (僅站所可見)</label>
                <textarea
                  defaultValue={selectedReq.admin_memo || ''}
                  onBlur={(e) => handleUpdateMemo(selectedReq.id, e.target.value)}
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

      {/* 改期彈跳對話框 (Reschedule Modal) */}
      {showRescheduleModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-5 border border-[#cbd5e1] space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#0f172a]">
                <Calendar className="w-4 h-4 text-[#f59e0b]" />
                <span>變更服務排程</span>
              </div>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="p-1 rounded-full text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#64748b]">
              原排程：<span className="font-bold text-[#0f172a]">{selectedReq.scheduled_date} ({getTimeSlotText(selectedReq.scheduled_slot_code || '')}) {selectedReq.scheduled_start_time}</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#374151] block mb-1">目標改期日期</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">時段</label>
                <select
                  value={rescheduleSlot}
                  onChange={(e) => {
                    const newSlot = e.target.value as 'morning' | 'afternoon';
                    setRescheduleSlot(newSlot);
                    setRescheduleTime(newSlot === 'morning' ? '08:00' : '13:00');
                  }}
                  className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg"
                >
                  <option value="morning">上午</option>
                  <option value="afternoon">下午</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#374151] block mb-1">預定開工時間</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg font-mono"
                >
                  {START_TIME_OPTIONS[rescheduleSlot].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#374151] block mb-1">改期原因 (選填)</label>
              <input
                type="text"
                placeholder="例如：農友臨時有事、天候調配..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#374151] block mb-1">📢 提醒農友注意事項 / 施工叮嚀 (選填，將顯示於 LINE 卡片)</label>
              <textarea
                rows={2}
                placeholder="例如：若遇雨天順延；現場需備妥 220V 電源與水源..."
                value={rescheduleNotice}
                onChange={(e) => setRescheduleNotice(e.target.value)}
                className="w-full text-xs p-2 border border-[#d1d5db] rounded-lg resize-none text-[#1f2937]"
              />
            </div>

            <div className="bg-[#fefce8] p-2.5 rounded-lg border border-[#fef08a] flex items-start gap-1.5 text-[11px] text-[#854d0e]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#ca8a04]" />
              <span>若新時段已被預約，改期將自動回滾並保留原排程有效。</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-[#d1d5db] text-[#4b5563] hover:bg-[#f9fafb]"
              >
                取消
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleReschedule(selectedReq.id)}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white shadow"
              >
                確認變更排程
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
