import React, { useState, useEffect } from 'react';
import liff from '@line/liff';
import { 
  SERVICE_OPTIONS, 
  POPULAR_CROPS, 
  KAOHSIUNG_DISTRICTS, 
  BRANCH_VOLUME_OPTIONS,
  DATE_FLEXIBILITY_OPTIONS,
  AREA_UNIT_OPTIONS,
  AreaUnit,
  CreateServiceRequestDto, 
  TimeSlot 
} from '../../../shared/types';
import { CheckCircle2, Calendar, MapPin, User, Phone, Sprout, Clock, Layers, CalendarClock } from 'lucide-react';
import { API_BASE } from '../config';

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '';
const STATION_NAME = (import.meta.env.VITE_STATION_NAME as string) || '高雄服務站';

export const ApplyForm: React.FC = () => {
  const isInLineClient = () => {
    if (!LIFF_ID) return false;
    try {
      return liff.isInClient();
    } catch {
      return false;
    }
  };

  const closeLineWindow = () => {
    if (LIFF_ID) {
      try {
        liff.closeWindow();
      } catch {}
    }
  };

  const [formData, setFormData] = useState<CreateServiceRequestDto>({
    contact_name: '',
    phone: '',
    service_type: SERVICE_OPTIONS[0],
    crop_type: POPULAR_CROPS[0],
    area_value: '',
    area_unit: '分',
    area_size: '',
    branch_volume: '中量',
    location_area: KAOHSIUNG_DISTRICTS[0],
    location_address: '',
    preferred_date: '',
    preferred_time_slot: 'morning',
    date_flexibility: '前後 3 天皆可',
    notes: '',
    line_user_id: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [lineProfile, setLineProfile] = useState<{ displayName: string; pictureUrl?: string; userId: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 抓取額滿黑名單
    fetch(`${API_BASE}/api/config/blocked-dates`)
      .then(res => res.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setBlockedDates(res.data.map((item: any) => item.date));
        }
      })
      .catch(() => {});

    // 2. 初始化 LIFF SDK
    if (LIFF_ID) {
      liff.init({ liffId: LIFF_ID })
        .then(() => {
        if (liff.isLoggedIn()) {
          liff.getProfile().then(profile => {
            if (profile) {
              setLineProfile({
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                userId: profile.userId
              });
              setFormData(prev => ({
                ...prev,
                contact_name: prev.contact_name || profile.displayName,
                line_user_id: profile.userId
              }));
            }
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('LIFF init deferred or in browser:', err);
      });
    }

    // 3. 渲染 Cloudflare Turnstile Managed 驗證元件 (interaction-only 模式：正常狀態無感隱形，僅異常時提示交互)
    const renderTurnstile = () => {
      if ((window as any).turnstile && turnstileContainerRef.current) {
        try {
          const sitekey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA'; // 官方 Managed Always-Pass 測試金鑰
          (window as any).turnstile.render(turnstileContainerRef.current, {
            sitekey,
            appearance: 'interaction-only',
            callback: (token: string) => {
              setTurnstileToken(token);
            },
            'error-callback': () => {
              console.warn('Turnstile challenge error, will use fallback');
            }
          });
        } catch (e) {
          console.warn('Turnstile init note:', e);
        }
      } else {
        setTimeout(renderTurnstile, 600);
      }
    };
    renderTurnstile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name || !formData.phone || !formData.preferred_date || !formData.area_value) {
      alert('請填寫姓名、電話、預估面積與希望施工日期');
      return;
    }

    const cleanPhone = formData.phone.replace(/[-\s]/g, '');
    const isMobile = /^09\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\d{7}$/.test(cleanPhone);

    if (!isMobile && !isLandline) {
      if (cleanPhone.startsWith('09')) {
        alert('手機號碼格式錯誤：需為 10 碼數字且以 09 開頭（目前為 ' + cleanPhone.length + ' 碼）');
      } else if (/^0[2-8]/.test(cleanPhone)) {
        alert('市話號碼格式錯誤：02~08 開頭需為 9 碼數字（目前為 ' + cleanPhone.length + ' 碼）');
      } else {
        alert('電話格式不正確：手機需為 09 開頭 10 碼，市話需為 02-08 開頭 9 碼數字');
      }
      return;
    }

    if (formData.crop_type.includes('其他') && !formData.notes?.trim()) {
      alert('您選擇了「其他」作物，請在下方「補充備註」填寫您的作物種類！');
      return;
    }

    if (blockedDates.includes(formData.preferred_date)) {
      alert('您選擇的希望施工日期目前服務站已額滿或暫停排程，請選擇其他日期！');
      return;
    }

    setIsSubmitting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      let idToken: string | undefined = undefined;
      if (LIFF_ID) {
        try {
          if (liff.isLoggedIn()) {
            idToken = liff.getIDToken() || undefined;
          }
        } catch (e) {
          console.warn('LIFF token retrieval warning:', e);
        }
      }
      const sitekey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA';
      let effectiveToken = turnstileToken;
      if (!effectiveToken && (window as any).turnstile) {
        try {
          effectiveToken = (window as any).turnstile.getResponse();
        } catch {}
      }
      // 測試金鑰環境防呆：若本機測試或受瀏覽器阻擋外掛影響未及時取得 Token，自動套用測試 Token
      if (!effectiveToken && (sitekey.startsWith('1x') || sitekey.startsWith('2x'))) {
        effectiveToken = 'XXXX.DUMMY.TOKEN.XXXX';
      }

      const payload = {
        ...formData,
        phone: cleanPhone,
        area_size: formData.area_value + ' ' + formData.area_unit,
        id_token: idToken,
        turnstile_token: effectiveToken || undefined
      };
      const res = await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        data = { success: false, message: text || `伺服器回應異常 (HTTP ${res.status})` };
      }

      if (res.ok && data.success) {
        setSubmittedId(data.data.id);
      } else {
        alert(data.message || `送出失敗 (狀態碼 ${res.status})，請稍後再試`);
      }
    } catch (err: any) {
      console.error('Submit request failed:', err);
      if (err?.name === 'AbortError') {
        alert('連線逾時（超過 15 秒）：現場手機收訊可能不佳，請確認行動網路後再試，或直接電話聯繫服務站。');
      } else {
        alert('網路連線失敗，請檢查網路：' + (err?.message || '伺服器無回應'));
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <div className="min-h-screen bg-[#f8f3e7] flex items-center justify-center p-4">
        <div className="bg-[#fffdf7] max-w-md w-full rounded-2xl shadow-xl border border-[#c8ad86] p-8 text-center">
          <div className="w-16 h-16 bg-[#dcebd6] text-[#2a5937] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-[#20271f] mb-2">服務申請已送出！</h2>
          <p className="text-sm text-[#657061] mb-4">
            單號：<span className="font-mono font-bold text-[#173820]">{submittedId}</span>
          </p>
          <div className="bg-[#f8f3e7] border border-[#e0d9cb] rounded-xl p-4 text-left text-sm text-[#657061] mb-6 space-y-2">
            <div>• {STATION_NAME}已收到您的需求通知。</div>
            <div>• 人員將儘速<span className="text-[#2a5937] font-bold">撥打電話</span>與您確認細節與確切施工時程。</div>
          </div>
          <div className="space-y-2.5">
            {isInLineClient() && (
              <button
                type="button"
                onClick={closeLineWindow}
                className="w-full py-3.5 bg-[#173820] hover:bg-[#0f2415] text-white font-bold rounded-xl transition shadow-md"
              >
                關閉視窗 (返回 LINE)
              </button>
            )}
            <button
              onClick={() => {
                setSubmittedId(null);
                setFormData({
                  ...formData,
                  area_value: '',
                  area_unit: '分',
                  preferred_date: '',
                  notes: ''
                });
              }}
              className={'w-full py-3 font-semibold rounded-xl transition ' + (
                isInLineClient()
                  ? 'bg-[#e0d9cb] hover:bg-[#d0c7b5] text-[#20271f]'
                  : 'bg-[#2a5937] hover:bg-[#173820] text-white shadow-md'
              )}
            >
              再填寫一筆申請
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f3e7] pb-16 text-[#20271f]">
      <header className="bg-[#173820] text-[#fffdf7] border-b-4 border-[#c8ad86] px-5 py-6 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcebd6] text-[#173820] text-xs font-bold mb-2">
            <span>🌱</span> {STATION_NAME}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#fffdf7]">客戶服務申請</h1>
          <p className="text-[#dcebd6]/90 text-sm mt-1">
            一次填寫完整需求，服務站專人將電話與您確認
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-4">
        {lineProfile && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#e8f3e5] border border-[#b8d6ae] rounded-2xl text-xs text-[#173820] font-medium mb-3 shadow-xs">
            {lineProfile.pictureUrl ? (
              <img src={lineProfile.pictureUrl} alt="LINE avatar" className="w-6 h-6 rounded-full object-cover border border-[#2a5937]/30" />
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#2a5937] text-white flex items-center justify-center font-bold text-[9px]">LINE</span>
            )}
            <div>
              已透過 LINE 自動辨識：<strong className="font-bold text-[#173820]">{lineProfile.displayName}</strong>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-[#fffdf7] rounded-2xl shadow-sm border border-[#e0d9cb] p-5 sm:p-6 space-y-6">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f] mb-2">
              <Sprout className="w-4 h-4 text-[#2a5937]" />
              服務項目 <span className="text-[#a33]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {SERVICE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setFormData({ ...formData, service_type: opt })}
                  className={'py-3 px-3 rounded-xl border text-sm font-semibold text-center transition-all ' + (
                    formData.service_type === opt
                      ? 'bg-[#f5faf2] border-[#2a5937] text-[#173820] shadow-sm ring-1 ring-[#2a5937] font-bold'
                      : 'border-[#d8d1c3] text-[#20271f] bg-[#fffdf7] hover:bg-[#f8f3e7]'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-sm font-bold text-[#20271f] mb-2">
                作物種類 <span className="text-[#a33]">*</span>
              </label>
              <input
                type="text"
                value={formData.crop_type}
                onChange={(e) => setFormData({ ...formData, crop_type: e.target.value })}
                placeholder="如：芭樂、芒果"
                className="w-full px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {POPULAR_CROPS.map((crop) => (
                  <button
                    type="button"
                    key={crop}
                    onClick={() => setFormData({ ...formData, crop_type: crop })}
                    className={'text-xs px-2.5 py-1 rounded-lg font-medium transition ' + (
                      formData.crop_type === crop
                        ? 'bg-[#2a5937] text-white shadow-sm'
                        : 'bg-[#eee2cf] text-[#20271f] hover:bg-[#e2d4bd]'
                    )}
                  >
                    {crop}
                  </button>
                ))}
              </div>
              {formData.crop_type.includes('其他') && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-2 font-medium">
                  💡 請在下方「補充備註」填寫您實際施作的作物種類。
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-bold text-[#20271f] mb-2">
                預估面積 <span className="text-[#a33]">*</span>
              </label>
              <div className="flex gap-2 w-full">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formData.area_value}
                  onChange={(e) => setFormData({ ...formData, area_value: e.target.value })}
                  placeholder="例如：3"
                  className="min-w-0 flex-1 px-3 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                  required
                />
                <select
                  value={formData.area_unit}
                  onChange={(e) => setFormData({ ...formData, area_unit: e.target.value as AreaUnit })}
                  className="w-20 shrink-0 px-2.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f] text-center cursor-pointer"
                >
                  {AREA_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 枝條數量 (必填) */}
          <div className="border border-[#e0d9cb] rounded-xl p-4 bg-[#f8f3e7]/70">
            <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f] mb-2">
              <Layers className="w-4 h-4 text-[#2a5937]" />
              枝條數量 <span className="text-[#856200] text-xs font-bold bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-full">必填</span>
            </label>
            <div className="space-y-2">
              {BRANCH_VOLUME_OPTIONS.map((vol) => (
                <label
                  key={vol}
                  onClick={() => setFormData({ ...formData, branch_volume: vol })}
                  className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ' + (
                    formData.branch_volume === vol
                      ? 'bg-[#f5faf2] border-[#2a5937] ring-1 ring-[#2a5937]'
                      : 'bg-[#fffdf7] border-[#d8d1c3] hover:bg-[#f8f3e7]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={'w-5 h-5 rounded-full border flex items-center justify-center ' + (
                      formData.branch_volume === vol ? 'border-[#2a5937]' : 'border-[#bfb8aa]'
                    )}>
                      {formData.branch_volume === vol && <span className="w-2.5 h-2.5 rounded-full bg-[#2a5937]" />}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[#20271f]">{vol}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f]">
              <MapPin className="w-4 h-4 text-[#2a5937]" />
              施作地點 <span className="text-[#a33]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={formData.location_area}
                onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
                className="px-3 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
              >
                {KAOHSIUNG_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                placeholder="地段/地號或詳細路名地標"
                className="col-span-2 px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                required
              />
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f]">
                <Calendar className="w-4 h-4 text-[#2a5937]" />
                希望施工日期 <span className="text-[#856200] text-xs font-bold bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-full">必填</span>
              </label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={formData.preferred_date}
                onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                className="w-full mt-1.5 px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                required
              />
              <p className="text-xs text-[#657061] mt-1">實際施工日期仍需由合作社致電確認。</p>
              {formData.preferred_date && blockedDates.includes(formData.preferred_date) && (
                <p className="text-xs text-red-600 font-bold mt-1">⚠️ 此日期服務站目前已額滿或調配中，請更換其他希望日期。</p>
              )}
            </div>

            {/* 日期彈性 (選填) */}
            <div className="border border-[#e0d9cb] rounded-xl p-4 bg-[#f8f3e7]/70 mt-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#20271f] mb-2">
                <CalendarClock className="w-3.5 h-3.5 text-[#2a5937]" />
                日期彈性 <span className="text-[#657061] text-[11px] font-normal bg-[#e0d9cb]/60 px-2 py-0.5 rounded-full">選填</span>
              </label>
              <div className="space-y-2">
                {DATE_FLEXIBILITY_OPTIONS.map((flex) => (
                  <label
                    key={flex}
                    onClick={() => setFormData({ ...formData, date_flexibility: flex })}
                    className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ' + (
                      formData.date_flexibility === flex
                        ? 'bg-[#f5faf2] border-[#2a5937] ring-1 ring-[#2a5937]'
                        : 'bg-[#fffdf7] border-[#d8d1c3] hover:bg-[#f8f3e7]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={'w-5 h-5 rounded-full border flex items-center justify-center ' + (
                        formData.date_flexibility === flex ? 'border-[#2a5937]' : 'border-[#bfb8aa]'
                      )}>
                        {formData.date_flexibility === flex && <span className="w-2.5 h-2.5 rounded-full bg-[#2a5937]" />}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#20271f]">{flex}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#657061] mb-1.5">
                <Clock className="w-3.5 h-3.5 text-[#2a5937]" />
                偏好時段
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'morning', label: '上午' },
                  { value: 'afternoon', label: '下午' },
                  { value: 'any', label: '皆可配合' }
                ].map((slot) => (
                  <button
                    type="button"
                    key={slot.value}
                    onClick={() => setFormData({ ...formData, preferred_time_slot: slot.value as TimeSlot })}
                    className={'py-2 px-2 text-xs font-semibold rounded-lg border transition ' + (
                      formData.preferred_time_slot === slot.value
                        ? 'bg-[#2a5937] text-white border-[#2a5937] font-bold shadow-sm'
                        : 'border-[#d8d1c3] bg-white text-[#20271f] hover:bg-[#f8f3e7]'
                    )}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#e0d9cb] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f] mb-1.5">
                  <User className="w-4 h-4 text-[#2a5937]" />
                  聯絡姓名 <span className="text-[#a33]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="請輸入姓名"
                  className="w-full px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-[#20271f] mb-1.5">
                  <Phone className="w-4 h-4 text-[#2a5937]" />
                  聯絡電話 <span className="text-[#a33]">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="手機 09xx (10碼) 或 市話 02~08 (9碼)"
                  maxLength={12}
                  className="w-full px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f]"
                  required
                />
                <p className="text-[11px] text-[#657061] mt-1">
                  格式：手機 09 開頭 10 碼數字，或市話 02~08 開頭 9 碼數字
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#657061] mb-1">
                補充備註 {formData.crop_type.includes('其他') ? <span className="text-[#a33] font-bold">（選擇其他作物請在此填寫作物種類 *）</span> : '(選填)'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={formData.crop_type.includes('其他') ? "請在此填寫作物種類，以及進出路況、水源等特殊需求" : "若有特殊進出路況、水源位置或其他需求可在此註明"}
                rows={2}
                className={'w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:outline-none text-sm font-medium bg-white text-[#20271f] ' + (
                  formData.crop_type.includes('其他') ? 'border-amber-400 focus:border-amber-500' : 'border-[#bfb8aa] focus:border-[#2a5937]'
                )}
              />
            </div>
          </div>

          {/* Cloudflare Turnstile 隱形無感驗證元件 (背景全自動運作，零畫面干擾、無任何警語) */}
          <div ref={turnstileContainerRef}></div>
          <div className="flex items-center justify-center -mt-2 mb-1">
            <p className="text-[11px] text-[#657061] flex items-center gap-1">
              <span>🛡️</span> 由 Cloudflare Turnstile 提供安全防護
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#2a5937] hover:bg-[#173820] active:scale-[0.99] text-white font-bold text-base rounded-xl transition shadow-lg shadow-[#2a5937]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? '送出中...' : '確認送出申請'}
          </button>
        </form>
      </main>
    </div>
  );
};
