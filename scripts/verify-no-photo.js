const fs = require('fs');
const path = require('path');

const sharedTypes = `export type RequestStatus = 'to_contact' | 'processing' | 'closed';
export type TimeSlot = 'morning' | 'afternoon' | 'any';
export type BranchVolume = '少量' | '中量' | '大量' | '不確定';
export type DateFlexibility = '僅此日期方便' | '前後 3 天皆可' | '日期可以再與我聯絡確認';
export type AreaUnit = '分' | '甲' | '畝' | '坪';

export interface ServiceRequest {
  id: string;
  created_at: string;
  updated_at: string;
  contact_name: string;
  phone: string;
  service_type: string;
  crop_type: string;
  area_size: string;
  area_value?: string;
  area_unit?: string;
  branch_volume?: string;
  location_area: string;
  location_address: string;
  preferred_date: string;
  preferred_time_slot: TimeSlot;
  date_flexibility?: string;
  notes?: string;
  status: RequestStatus;
  admin_memo?: string;
  line_user_id?: string;
}

export interface CreateServiceRequestDto {
  contact_name: string;
  phone: string;
  service_type: string;
  crop_type: string;
  area_size?: string;
  area_value: string;
  area_unit: AreaUnit;
  branch_volume?: string;
  location_area: string;
  location_address: string;
  preferred_date: string;
  preferred_time_slot: TimeSlot;
  date_flexibility?: string;
  notes?: string;
  line_user_id?: string;
}

export interface UpdateServiceRequestDto {
  status?: RequestStatus;
  admin_memo?: string;
}

export interface BlockedDate {
  date: string;
  reason?: string;
  created_at: string;
}

export const AREA_UNIT_OPTIONS: AreaUnit[] = ['分', '甲', '畝', '坪'];
export const BRANCH_VOLUME_OPTIONS: BranchVolume[] = ['少量', '中量', '大量', '不確定'];
export const DATE_FLEXIBILITY_OPTIONS: DateFlexibility[] = ['僅此日期方便', '前後 3 天皆可', '日期可以再與我聯絡確認'];

export const SERVICE_OPTIONS = [
  '果樹枝條粉碎',
  '果樹代耕',
  '農機出租',
  '其他農業服務'
] as const;

export const POPULAR_CROPS = [
  '芭樂',
  '蜜棗',
  '芒果',
  '竹子',
  '其他(在備註內填寫作物種類)'
] as const;

export const KAOHSIUNG_DISTRICTS = [
  '燕巢區',
  '大社區',
  '阿蓮區',
  '田寮區',
  '岡山區',
  '橋頭區',
  '楠梓區',
  '旗山區',
  '美濃區',
  '六龜區'
] as const;
`;

const applyForm = `import React, { useState, useEffect } from 'react';
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

export const ApplyForm: React.FC = () => {
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
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/config/blocked-dates')
      .then(res => res.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setBlockedDates(res.data.map((item: any) => item.date));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name || !formData.phone || !formData.preferred_date || !formData.area_value) {
      alert('請填寫姓名、電話、預估面積與希望施工日期');
      return;
    }

    const cleanPhone = formData.phone.replace(/[-\\s]/g, '');
    const isMobile = /^09\\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\\d{7}$/.test(cleanPhone);

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
    try {
      const payload = {
        ...formData,
        phone: cleanPhone,
        area_size: formData.area_value + ' ' + formData.area_unit
      };
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedId(data.data.id);
      } else {
        alert(data.message || '送出失敗，請稍後再試');
      }
    } catch (err) {
      alert('網路連線失敗，請檢查網路');
    } finally {
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
            <div>• 高雄服務站已收到您的需求通知。</div>
            <div>• 人員將儘速<span className="text-[#2a5937] font-bold">撥打電話</span>與您確認細節與確切施工時程。</div>
          </div>
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
            className="w-full py-3.5 bg-[#2a5937] hover:bg-[#173820] text-white font-bold rounded-xl transition shadow-md"
          >
            再填寫一筆申請
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f3e7] pb-16 text-[#20271f]">
      <header className="bg-[#173820] text-[#fffdf7] border-b-4 border-[#c8ad86] px-5 py-6 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcebd6] text-[#173820] text-xs font-bold mb-2">
            <span>🌱</span> 高雄服務站
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#fffdf7]">客戶服務申請</h1>
          <p className="text-[#dcebd6]/90 text-sm mt-1">
            一次填寫完整需求，服務站專人將電話與您確認
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-4">
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
`;

const adminDashboard = `import React, { useState, useEffect } from 'react';
import { ServiceRequest, RequestStatus } from '../../../shared/types';
import { Phone, CheckCircle2, RefreshCw, X, MapPin } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<ServiceRequest | null>(null);
  const [currentFilter, setCurrentFilter] = useState<RequestStatus | 'all'>('to_contact');
  const [counts, setCounts] = useState({ to_contact: 0, processing: 0, closed: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = currentFilter === 'all' 
        ? '/api/admin/requests' 
        : \`/api/admin/requests?status=\${currentFilter}\`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentFilter]);

  const handleUpdateStatus = async (id: string, newStatus: RequestStatus, memo?: string) => {
    setSavingStatus(true);
    try {
      const res = await fetch(\`/api/admin/requests/\${id}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_memo: memo })
      });
      const data = await res.json();
      if (data.success) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, admin_memo: memo ?? r.admin_memo } : r));
        if (selectedReq && selectedReq.id === id) {
          setSelectedReq({ ...selectedReq, status: newStatus, admin_memo: memo ?? selectedReq.admin_memo });
        }
        fetchRequests();
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
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="p-2 text-[#657061] hover:text-[#20271f] rounded-lg hover:bg-[#eee2cf] border border-[#d8d1c3] text-xs font-semibold flex items-center gap-1 transition"
        >
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
          <span>重整</span>
        </button>
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
`;

const backendLine = `export function generateFlexNotification(request: any) {
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[request.preferred_time_slot] || request.preferred_time_slot;

  return {
    type: 'flex',
    altText: '【新服務申請】' + request.contact_name + ' - ' + request.service_type,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#15803d',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🌱 行農合作社 · 高雄服務站',
            color: '#bbf7d0',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: '收到新的服務申請需求',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '申請人', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.contact_name + ' (' + request.phone + ')', size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.crop_type + ' · ' + request.area_size + (request.branch_volume ? ' (' + request.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '希望日期', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.preferred_date + ' (' + slotText + ')' + (request.date_flexibility ? ' · ' + request.date_flexibility : ''), size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '地點', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.location_area + ' ' + request.location_address, size: 'sm', color: '#0f172a', flex: 5, wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '撥打電話：' + request.phone,
              uri: 'tel:' + request.phone
            },
            style: 'primary',
            color: '#15803d'
          }
        ]
      }
    }
  };
}

export async function pushLineMessage(token: string, targetId: string, flexMessage: any) {
  if (!token || !targetId) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        to: targetId,
        messages: [flexMessage]
      })
    });
  } catch (err) {
    console.error('Failed to push LINE message:', err);
  }
}
`;

const backendIndex = `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateFlexNotification, pushLineMessage } from './line';
import { CreateServiceRequestDto, UpdateServiceRequestDto, RequestStatus } from '../../shared/types';

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  ADMIN_NOTIFY_USER_ID?: string;
  STATION_NAME?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', station: c.env.STATION_NAME || '高雄服務站', time: new Date().toISOString() });
});

// 1. 農友送出服務申請
app.post('/api/requests', async (c) => {
  try {
    const body = await c.req.json<CreateServiceRequestDto>();
    
    if (!body.contact_name || !body.phone || !body.service_type || !body.preferred_date) {
      return c.json({ success: false, message: '請完整填寫姓名、電話、服務項目與希望施工日期' }, 400);
    }

    const cleanPhone = (body.phone || '').replace(/[-\\s]/g, '');
    const isMobile = /^09\\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\\d{7}$/.test(cleanPhone);

    if (!isMobile && !isLandline) {
      return c.json({ success: false, message: '電話格式錯誤：手機需為 09 開頭 10 碼，市話需為 02-08 開頭 9 碼數字' }, 400);
    }

    if ((body.crop_type || '').includes('其他') && !body.notes?.trim()) {
      return c.json({ success: false, message: '選擇其他作物種類時，請在補充備註填寫作物種類' }, 400);
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const id = 'REQ-' + datePrefix + '-' + randomSuffix;
    const now = new Date().toISOString();

    const computedAreaSize = body.area_size || (body.area_value ? (body.area_value + ' ' + (body.area_unit || '分')) : '未填寫');

    const insertSql = 'INSERT INTO service_requests (' +
      'id, created_at, updated_at, contact_name, phone, service_type, crop_type, ' +
      'area_size, area_value, area_unit, branch_volume, location_area, location_address, preferred_date, preferred_time_slot, ' +
      'date_flexibility, notes, status, line_user_id' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    await c.env.DB.prepare(insertSql).bind(
      id, now, now,
      body.contact_name.trim(),
      cleanPhone,
      body.service_type,
      body.crop_type || '其他',
      computedAreaSize,
      body.area_value ? String(body.area_value) : null,
      body.area_unit || null,
      body.branch_volume || '中量',
      body.location_area || '燕巢區',
      body.location_address || '',
      body.preferred_date,
      body.preferred_time_slot || 'morning',
      body.date_flexibility || '前後 3 天皆可',
      body.notes || '',
      'to_contact',
      body.line_user_id || null
    ).run();

    if (c.env.LINE_CHANNEL_ACCESS_TOKEN && c.env.ADMIN_NOTIFY_USER_ID) {
      const flexMsg = generateFlexNotification({
        ...body,
        area_size: computedAreaSize,
        id
      });
      c.executionCtx.waitUntil(
        pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, c.env.ADMIN_NOTIFY_USER_ID, flexMsg)
      );
    }

    return c.json({
      success: true,
      message: '服務申請已成功送出，服務站人員將儘速電話與您聯繫！',
      data: { id }
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message || '伺服器發生錯誤' }, 500);
  }
});

// 2. 站所人員查詢申請單列表
app.get('/api/admin/requests', async (c) => {
  try {
    const status = c.req.query('status') as RequestStatus | undefined;
    let query = 'SELECT * FROM service_requests';
    const params: any[] = [];

    if (status && ['to_contact', 'processing', 'closed'].includes(status)) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all();

    const countSql = 'SELECT ' +
      "SUM(CASE WHEN status = 'to_contact' THEN 1 ELSE 0 END) as to_contact_count, " +
      "SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count, " +
      "SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count, " +
      'COUNT(*) as total_count FROM service_requests';

    const counts = await c.env.DB.prepare(countSql).first();

    return c.json({
      success: true,
      data: result.results,
      counts: {
        to_contact: (counts as any)?.to_contact_count || 0,
        processing: (counts as any)?.processing_count || 0,
        closed: (counts as any)?.closed_count || 0,
        total: (counts as any)?.total_count || 0
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 3. 站所人員更新狀態與備註
app.patch('/api/admin/requests/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateServiceRequestDto>();
    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (body.status && ['to_contact', 'processing', 'closed'].includes(body.status)) {
      updates.push('status = ?');
      params.push(body.status);
    }

    if (body.admin_memo !== undefined) {
      updates.push('admin_memo = ?');
      params.push(body.admin_memo);
    }

    params.push(id);

    const updateSql = 'UPDATE service_requests SET ' + updates.join(', ') + ' WHERE id = ?';
    await c.env.DB.prepare(updateSql).bind(...params).run();

    return c.json({ success: true, message: '狀態已更新' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 4. 取得手動關閉日期
app.get('/api/config/blocked-dates', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT date, reason FROM blocked_dates ORDER BY date ASC').all();
    return c.json({ success: true, data: result.results });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 5. 站所手動關閉/開啟特定日期
app.post('/api/admin/blocked-dates', async (c) => {
  try {
    const { date, reason, action } = await c.req.json<{ date: string; reason?: string; action: 'block' | 'unblock' }>();
    if (!date) return c.json({ success: false, message: '請指定日期' }, 400);

    if (action === 'unblock') {
      await c.env.DB.prepare('DELETE FROM blocked_dates WHERE date = ?').bind(date).run();
      return c.json({ success: true, message: '已取消關閉 ' + date });
    } else {
      const now = new Date().toISOString();
      const insertBlocked = 'INSERT OR REPLACE INTO blocked_dates (date, reason, created_at) VALUES (?, ?, ?)';
      await c.env.DB.prepare(insertBlocked).bind(date, reason || '當日服務站調配額滿', now).run();
      return c.json({ success: true, message: '已手動關閉 ' + date });
    }
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
`;

fs.writeFileSync(path.join(__dirname, '../packages/shared/types.ts'), sharedTypes, 'utf8');
fs.writeFileSync(path.join(__dirname, '../packages/frontend/src/components/ApplyForm.tsx'), applyForm, 'utf8');
fs.writeFileSync(path.join(__dirname, '../packages/frontend/src/components/AdminDashboard.tsx'), adminDashboard, 'utf8');
fs.writeFileSync(path.join(__dirname, '../packages/backend/src/line.ts'), backendLine, 'utf8');
fs.writeFileSync(path.join(__dirname, '../packages/backend/src/index.ts'), backendIndex, 'utf8');
console.log('Setup successfully completed!');


