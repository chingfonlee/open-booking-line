import React, { useState, useEffect, useRef, useId } from 'react';
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
  TimeSlot,
  AvailabilityResponse
} from '../../../shared/types';
import { 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  User, 
  Phone, 
  Sprout, 
  Clock, 
  Layers, 
  CalendarClock, 
  PhoneCall,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  ShieldCheck,
  Check
} from 'lucide-react';
import { API_BASE } from '../config';
import { getLiffSearchParams } from '../utils/liffUrl';
import { saveFormDraft, loadFormDraft, clearFormDraft, hasMeaningfulDraftContent } from '../utils/formDraft';
import { validateStep1, validateStep2, validateStep3, validateAllSteps } from '../utils/formValidation';
import { STEPS, sanitizeTargetStep, getNextStepNumber, canSubmitForm } from '../utils/formSteps';

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '';
const STATION_NAME = (import.meta.env.VITE_STATION_NAME as string) || '預約服務站';

export const ApplyForm: React.FC = () => {
  const isManualMode = getLiffSearchParams().get('mode') === 'manual';

  const defaultFormData: CreateServiceRequestDto = {
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
  };

  // 步驟狀態 (1~4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [returnToReview, setReturnToReview] = useState<boolean>(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // 表單資料與草稿狀態
  const [formData, setFormData] = useState<CreateServiceRequestDto>(defaultFormData);
  const [draftSaved, setDraftSaved] = useState<boolean>(false);
  const [pendingDraft, setPendingDraft] = useState<{ formData: Partial<CreateServiceRequestDto>; step: number; savedAt: number } | null>(null);

  // 伺服器狀態與安全性
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [lineProfile, setLineProfile] = useState<{ displayName: string; pictureUrl?: string; userId: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileStatus, setTurnstileStatus] = useState<string | null>(null);
  
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileRetryCountRef = useRef<number>(0);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastStepChangeTimeRef = useRef<number>(Date.now());

  // Accessibility unique IDs
  const headingId = useId();

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

  // 步驟路由切換（同步 URL hash 與 History API，支援手機原生返回鍵，換步自動聚焦標題）
  const navigateToStep = (targetStep: number, fromReviewMode = false) => {
    const safeStep = sanitizeTargetStep(targetStep, formData, availability, blockedDates);
    setCurrentStep(safeStep);
    lastStepChangeTimeRef.current = Date.now();
    if (!fromReviewMode) {
      setReturnToReview(false);
    }
    setStepErrors({});
    setSubmitError(null);

    try {
      window.history.pushState({ step: safeStep }, '', `#step-${safeStep}`);
    } catch {}

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      stepHeadingRef.current?.focus();
    }, 100);
  };

  // 監聽瀏覽器 / LINE 內建返回鍵 (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      let targetStep = 1;
      if (e.state && typeof e.state.step === 'number') {
        targetStep = e.state.step;
      } else {
        const match = window.location.hash.match(/#step-([1-4])/);
        if (match) {
          targetStep = parseInt(match[1], 10);
        }
      }
      const safeStep = sanitizeTargetStep(targetStep, formData, availability, blockedDates);
      setCurrentStep(safeStep);
      lastStepChangeTimeRef.current = Date.now();
      setStepErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        stepHeadingRef.current?.focus();
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [formData, availability, blockedDates]);

  // 1. 初始化草稿載入：農家共用手機防洩漏，不直接填入，先詢問確認
  useEffect(() => {
    const draft = loadFormDraft();
    if (draft && draft.formData && hasMeaningfulDraftContent(draft.formData)) {
      // 發現具實質使用者輸入的有效草稿：跳出詢問彈窗，待使用者確認再填入
      setPendingDraft(draft);
    } else {
      // 若為空資料或僅有預設值的殘留草稿，主動徹底清理
      clearFormDraft();
    }

    // 首次進入一律使用 replaceState，防止返回鍵需按兩次
    const hashMatch = window.location.hash.match(/#step-([1-4])/);
    const initStep = hashMatch ? parseInt(hashMatch[1], 10) : 1;
    const safeInitStep = sanitizeTargetStep(initStep, defaultFormData, availability, blockedDates);
    try {
      window.history.replaceState({ step: safeInitStep }, '', `#step-${safeInitStep}`);
    } catch {}
  }, []);

  // 使用者確認還原草稿
  const handleAcceptDraft = () => {
    if (pendingDraft) {
      setFormData(prev => ({
        ...prev,
        ...pendingDraft.formData
      }));
      const safeStep = sanitizeTargetStep(pendingDraft.step || 1, pendingDraft.formData, availability, blockedDates);
      setCurrentStep(safeStep);
      lastStepChangeTimeRef.current = Date.now();
      try {
        window.history.replaceState({ step: safeStep }, '', `#step-${safeStep}`);
      } catch {}
      setPendingDraft(null);
      setTimeout(() => {
        stepHeadingRef.current?.focus();
      }, 100);
    }
  };

  // 使用者拒絕還原（重新開始）
  const handleDiscardDraft = () => {
    clearFormDraft();
    setFormData(defaultFormData);
    setPendingDraft(null);
    setCurrentStep(1);
    try {
      window.history.replaceState({ step: 1 }, '', '#step-1');
    } catch {}
  };

  // 2. 表單資料自動儲存草稿（自最後修改起算 7 天，try/catch 嚴格包覆）
  useEffect(() => {
    if (!submittedId && !pendingDraft) {
      if (hasMeaningfulDraftContent(formData)) {
        const saved = saveFormDraft(formData, currentStep);
        setDraftSaved(saved);
      } else {
        // 若使用者清空欄位或剛開啟空表單，不觸發草稿儲存
        setDraftSaved(false);
      }
    }
  }, [formData, currentStep, submittedId, pendingDraft]);

  // 3. 抓取 Availability 可用性與 LIFF profile
  useEffect(() => {
    fetch(`${API_BASE}/api/availability`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setAvailability(res.data);
          if (res.data.dates) {
            const blocked = Object.values(res.data.dates)
              .filter((d: any) => !d.selectable)
              .map((d: any) => d.date);
            setBlockedDates(blocked);
          }
        }
      })
      .catch(() => {
        fetch(`${API_BASE}/api/config/blocked-dates`)
          .then(res => res.json())
          .then(res => {
            if (res.success && Array.isArray(res.data)) {
              setBlockedDates(res.data.map((item: any) => item.date));
            }
          })
          .catch(() => {});
      });

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

    // 4. Cloudflare Turnstile Managed 驗證初始化（含過期自動重取與重試次數上限保護）
    const renderTurnstile = () => {
      if ((window as any).turnstile && turnstileContainerRef.current) {
        try {
          const sitekey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '1x00000000000000000000AA';
          const widgetId = (window as any).turnstile.render(turnstileContainerRef.current, {
            sitekey,
            appearance: 'interaction-only',
            callback: (token: string) => {
              setTurnstileToken(token);
              setTurnstileStatus(null);
              turnstileRetryCountRef.current = 0;
            },
            'expired-callback': () => {
              setTurnstileToken('');
              if (turnstileRetryCountRef.current < 3) {
                turnstileRetryCountRef.current += 1;
                setTurnstileStatus('安全驗證權杖逾期，已為您自動重新獲取');
                if ((window as any).turnstile && turnstileWidgetIdRef.current) {
                  (window as any).turnstile.reset(turnstileWidgetIdRef.current);
                }
              } else {
                setTurnstileStatus('驗證連線等待逾時，送單時請點擊按鈕重試');
              }
            },
            'error-callback': () => {
              setTurnstileToken('');
              setTurnstileStatus('安全驗證連線不穩定，將於送單時自動重試');
            }
          });
          turnstileWidgetIdRef.current = widgetId;
        } catch (e) {
          console.warn('Turnstile init note:', e);
        }
      } else {
        setTimeout(renderTurnstile, 600);
      }
    };
    renderTurnstile();
  }, []);

  // 驗證當前步驟
  const validateCurrentStep = (stepNum: number): { isValid: boolean; errors: Record<string, string> } => {
    let result = { isValid: true, errors: {} as Record<string, string> };
    if (stepNum === 1) {
      result = validateStep1(formData);
    } else if (stepNum === 2) {
      result = validateStep2(formData, availability, blockedDates);
    } else if (stepNum === 3) {
      result = validateStep3(formData);
    } else if (stepNum === 4) {
      result = validateAllSteps(formData, availability, blockedDates);
    }

    setStepErrors(result.errors);
    return result;
  };

  // 步驟導覽處理：下一步
  const handleNext = () => {
    const { isValid, errors } = validateCurrentStep(currentStep);
    if (!isValid) {
      // 焦點移到第一個錯誤欄位，無障礙友善
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(firstErrorKey);
        if (el) el.focus();
      }
      return;
    }

    const nextStep = getNextStepNumber(currentStep, returnToReview);
    if (returnToReview) {
      setReturnToReview(false);
    }
    navigateToStep(nextStep);
  };

  // 步驟導覽處理：上一步
  const handlePrev = () => {
    if (currentStep > 1) {
      navigateToStep(currentStep - 1);
    }
  };

  // 從核對頁跳轉修改特定步驟
  const handleJumpToEdit = (targetStep: number) => {
    setReturnToReview(true);
    navigateToStep(targetStep, true);
  };

  // 手動清除草稿（二次確認防誤觸）
  const handleClearDraft = () => {
    if (window.confirm('確定要清除已儲存的草稿並重新填寫嗎？此動作將清除本機暫存資料。')) {
      clearFormDraft();
      setFormData(defaultFormData);
      setStepErrors({});
      setSubmitError(null);
      setDraftSaved(false);
      navigateToStep(1);
    }
  };

  // 最終送出申請（含前端 + 後端二次可用性驗證）
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 嚴格送單防護：必須處於步驟 4、非送出中、且已脫離切換冷卻期
    if (!canSubmitForm(currentStep, isSubmitting, lastStepChangeTimeRef.current)) {
      return;
    }

    setSubmitError(null);

    // 1. 全欄位校驗
    const validation = validateAllSteps(formData, availability, blockedDates);
    if (!validation.isValid) {
      setStepErrors(validation.errors);
      setSubmitError('填寫資料有缺漏或不符合規則，請檢查標記欄位');
      const firstErrorKey = Object.keys(validation.errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(firstErrorKey);
        if (el) el.focus();
      }
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
      // 測試金鑰環境防呆
      if (!effectiveToken && (sitekey.startsWith('1x') || sitekey.startsWith('2x'))) {
        effectiveToken = 'XXXX.DUMMY.TOKEN.XXXX';
      }

      if (!effectiveToken) {
        setSubmitError('安全驗證尚未完成，請稍候重試或重新整理頁面');
        if ((window as any).turnstile && turnstileWidgetIdRef.current) {
          (window as any).turnstile.reset(turnstileWidgetIdRef.current);
        }
        setIsSubmitting(false);
        clearTimeout(timeoutId);
        return;
      }

      const cleanPhone = formData.phone.replace(/[-\s]/g, '');
      const payload = {
        ...formData,
        phone: cleanPhone,
        area_size: formData.area_value + ' ' + formData.area_unit,
        id_token: idToken,
        turnstile_token: effectiveToken
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
        // 送出成功：立即清空草稿，並以 replaceState 清除歷史步數，防止返回鍵退回空表單
        clearFormDraft();
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
        setSubmittedId(data.data.id);
      } else {
        // 若伺服器因可用性、電話或欄位回傳 400 錯誤，精確提示
        setSubmitError(data.message || `送出失敗 (狀態碼 ${res.status})，請稍後再試`);
        if (data.message?.includes('日期') || data.message?.includes('時段') || data.message?.includes('預約')) {
          setStepErrors(prev => ({ ...prev, preferred_date: data.message }));
        }
      }
    } catch (err: any) {
      console.error('Submit request failed:', err);
      if (err?.name === 'AbortError') {
        setSubmitError('連線逾時（超過 15 秒）：現場手機收訊可能不佳，請確認行動網路後再試，或直接電話聯繫服務站。');
      } else {
        setSubmitError('網路連線失敗，請檢查網路：' + (err?.message || '伺服器無回應'));
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  const selectedDateAvailability = formData.preferred_date && availability?.dates ? availability.dates[formData.preferred_date] : null;

  // 成功提交畫面
  if (submittedId) {
    return (
      <div className="min-h-screen bg-[#f8f3e7] flex items-center justify-center p-4">
        <div className="bg-[#fffdf7] max-w-md w-full rounded-2xl shadow-xl border border-[#c8ad86] p-8 text-center">
          <div className="w-16 h-16 bg-[#dcebd6] text-[#2a5937] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-[#20271f] mb-2">服務申請已送出！</h2>
          <p className="text-base text-[#657061] mb-4">
            申請編號：<span className="font-mono font-bold text-[#173820] text-lg">{submittedId}</span>
          </p>
          <div className="bg-[#f8f3e7] border border-[#e0d9cb] rounded-xl p-4 text-left text-sm text-[#657061] mb-6 space-y-2">
            <div>• {STATION_NAME}已收到您的需求通知。</div>
            <div>• 服務站專人將儘速<strong className="text-[#2a5937] font-bold">撥打電話</strong>與您核對施作細節與工期。</div>
            <div>• 本次申請資料已為您建立檔案，草稿已安全清除。</div>
          </div>
          <div className="space-y-3">
            {isInLineClient() && (
              <button
                type="button"
                onClick={closeLineWindow}
                className="w-full min-h-[48px] py-3.5 bg-[#173820] hover:bg-[#0f2415] text-white font-bold text-base rounded-xl transition shadow-md flex items-center justify-center"
              >
                關閉視窗 (返回 LINE)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearFormDraft();
                setSubmittedId(null);
                setFormData(defaultFormData);
                setDraftSaved(false);
                navigateToStep(1);
              }}
              className={'w-full min-h-[48px] py-3.5 font-semibold text-base rounded-xl transition flex items-center justify-center ' + (
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
    <div className="min-h-screen bg-[#f8f3e7] pb-24 text-[#20271f]">
      {/* 草稿還原詢問彈窗（農家共用手機個資保護） */}
      {pendingDraft && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#fffdf7] max-w-sm w-full rounded-2xl shadow-2xl border border-[#c8ad86] p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-[#dcebd6] text-[#2a5937] rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-[#20271f] mb-1.5">
              找到上次未完成的申請草稿
            </h3>
            <p className="text-xs text-[#657061] mb-2 leading-relaxed">
              系統保留了您上次填寫的內容（自最後修改起保留 7 天）。
            </p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-xl mb-5 leading-normal">
              🔒 若此手機為他人共用，建議點選「重新開始」清除紀錄以維護隱私。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="min-h-[44px] py-2.5 px-3 bg-[#f8f3e7] hover:bg-[#e0d9cb] border border-[#bfb8aa] text-[#20271f] font-bold text-sm rounded-xl transition"
              >
                重新開始
              </button>
              <button
                type="button"
                onClick={handleAcceptDraft}
                className="min-h-[44px] py-2.5 px-3 bg-[#2a5937] hover:bg-[#173820] text-white font-bold text-sm rounded-xl transition shadow-sm"
              >
                繼續填寫
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 頁首 Header */}
      <header className="bg-[#173820] text-[#fffdf7] border-b-4 border-[#c8ad86] px-5 py-5 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcebd6] text-[#173820] text-xs font-bold">
              <Sprout className="w-3.5 h-3.5 text-[#173820]" aria-hidden="true" />
              <span>{STATION_NAME}</span>
            </div>
          </div>
          <h1 id={headingId} className="text-2xl font-black tracking-tight text-[#fffdf7]">
            客戶服務申請
          </h1>
          <p className="text-[#dcebd6]/90 text-sm mt-1">
            4 步驟快速登記，服務站專人將電話與您聯繫確認
          </p>
        </div>
      </header>

      {/* 樣式 C：分段進度條加階段名稱與步驟指示 */}
      <div className="bg-[#fffdf7] border-b border-[#e0d9cb] px-4 py-3 sticky top-0 z-20 shadow-xs">
        <div className="max-w-xl mx-auto">
          {/* 四段式進度條 */}
          <div 
            className="grid grid-cols-4 gap-2 mb-2" 
            role="progressbar" 
            aria-valuenow={currentStep} 
            aria-valuemin={1} 
            aria-valuemax={4} 
            aria-valuetext={`第 ${currentStep} 步，共 4 步：${STEPS[currentStep - 1]?.name}`}
            aria-label="申請表單填寫進度"
          >
            {STEPS.map((step) => {
              const isPast = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              return (
                <div key={step.id} className="flex flex-col gap-1.5">
                  <div
                    className={'h-2 rounded-full transition-all duration-300 ' + (
                      isPast
                        ? 'bg-[#2a5937]'
                        : isCurrent
                          ? 'bg-[#2a5937] ring-2 ring-[#2a5937]/30'
                          : 'bg-[#e0d9cb]'
                    )}
                  />
                  <div className="flex items-center justify-center gap-1">
                    {isPast && <Check className="w-3 h-3 text-[#2a5937] shrink-0" aria-hidden="true" />}
                    <span
                      aria-current={isCurrent ? 'step' : undefined}
                      className={'text-xs text-center transition-colors ' + (
                        isCurrent
                          ? 'font-bold text-[#173820]'
                          : isPast
                            ? 'font-medium text-[#2a5937]'
                            : 'font-normal text-[#8c9489]'
                      )}
                    >
                      {step.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 狀態條：當前階段描述 + 自動草稿提示 (aria-live) */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-[#f0eae1] text-[#657061]">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-[#173820] font-bold">第 {currentStep} 步</span>
              <span>/ 共 4 步：{STEPS[currentStep - 1]?.name}</span>
            </div>
            <div className="flex items-center gap-2" aria-live="polite">
              {draftSaved && (
                <span className="flex items-center gap-1 text-[#2a5937] text-[11px] font-medium" title="草稿暫存於本機瀏覽器，自最後修改起保留 7 天">
                  <Check className="w-3 h-3" aria-hidden="true" />
                  已暫存草稿
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 mt-4">
        {/* 代客掛單模式橫幅 */}
        {isManualMode && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#eef4f8] border border-[#a6c8e0] rounded-2xl text-xs text-[#1e4a6d] font-medium mb-3 shadow-xs">
            <PhoneCall className="w-5 h-5 text-[#2b6cb0] shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-bold text-[#1e4a6d] block text-sm">站所代客電話登記模式</strong>
              目前為幹部代填掛單作業，請向來電農友確認田區與需求後送出。
            </div>
          </div>
        )}

        {/* LINE 自動辨識橫幅 */}
        {lineProfile && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#e8f3e5] border border-[#b8d6ae] rounded-2xl text-xs text-[#173820] font-medium mb-3 shadow-xs">
            {lineProfile.pictureUrl ? (
              <img src={lineProfile.pictureUrl} alt="LINE avatar" className="w-6 h-6 rounded-full object-cover border border-[#2a5937]/30" />
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#2a5937] text-white flex items-center justify-center font-bold text-[9px]" aria-hidden="true">LINE</span>
            )}
            <div>
              已透過 LINE 自動辨識：<strong className="font-bold text-[#173820]">{lineProfile.displayName}</strong>
            </div>
          </div>
        )}

        {/* 從確認頁跳轉修改時的醒目提示 */}
        {returnToReview && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#fef9c3] border border-[#fde047] rounded-xl text-xs text-[#854d0e] font-medium mb-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>您目前正在修改資料，完成後可直接返回確認頁。</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReturnToReview(false);
                navigateToStep(4);
              }}
              className="font-bold underline text-[#a16207] hover:text-[#713f12] ml-2 shrink-0"
            >
              直接回確認頁
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          onKeyDown={(e) => {
            // 全域防止在輸入框按 Enter 觸發原生送單
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target && target.tagName === 'INPUT') {
                e.preventDefault();
                // 處於步驟 1~3 時按 Enter 輔助前進至下一步
                if (currentStep < 4) {
                  handleNext();
                }
              }
            }
          }}
          className="bg-[#fffdf7] rounded-2xl shadow-sm border border-[#e0d9cb] p-5 sm:p-6 space-y-6"
        >
          {/* ======================================================== */}
          {/* 步驟 1：需求項目 */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-[#f0eae1] pb-3">
                <h2 
                  ref={stepHeadingRef} 
                  tabIndex={-1} 
                  className="text-lg font-bold text-[#173820] flex items-center gap-2 outline-none"
                >
                  <Sprout className="w-5 h-5 text-[#2a5937]" aria-hidden="true" />
                  步驟 1：選擇服務項目與農地資訊
                </h2>
                <p className="text-xs text-[#657061] mt-0.5">請選擇您需要代耕或處理的項目與作物種類</p>
              </div>

              {/* 服務項目 */}
              <div>
                <label className="flex items-center gap-1.5 text-base font-bold text-[#20271f] mb-2">
                  <span>服務項目</span>
                  <span className="text-[#c0392b] text-sm">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {SERVICE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setFormData({ ...formData, service_type: opt })}
                      className={'min-h-[48px] py-3 px-3 rounded-xl border text-base font-semibold text-center transition-all ' + (
                        formData.service_type === opt
                          ? 'bg-[#f5faf2] border-[#2a5937] text-[#173820] shadow-sm ring-2 ring-[#2a5937] font-bold'
                          : 'border-[#d8d1c3] text-[#20271f] bg-[#fffdf7] hover:bg-[#f8f3e7]'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {stepErrors.service_type && (
                  <div id="service_type-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{stepErrors.service_type}</span>
                  </div>
                )}
              </div>

              {/* 作物種類與預估面積 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor="crop_type" className="block text-base font-bold text-[#20271f] mb-2">
                    作物種類 <span className="text-[#c0392b] text-sm">*</span>
                  </label>
                  <input
                    id="crop_type"
                    type="text"
                    value={formData.crop_type}
                    onChange={(e) => setFormData({ ...formData, crop_type: e.target.value })}
                    placeholder="如：芭樂、芒果"
                    aria-invalid={!!stepErrors.crop_type}
                    aria-describedby={stepErrors.crop_type ? 'crop_type-error' : undefined}
                    className="w-full min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                    required
                  />
                  {stepErrors.crop_type && (
                    <div id="crop_type-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.crop_type}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {POPULAR_CROPS.map((crop) => (
                      <button
                        type="button"
                        key={crop}
                        onClick={() => setFormData({ ...formData, crop_type: crop })}
                        className={'text-xs min-h-[36px] px-3 py-1.5 rounded-lg font-medium transition ' + (
                          formData.crop_type === crop
                            ? 'bg-[#2a5937] text-white shadow-sm font-bold'
                            : 'bg-[#eee2cf] text-[#20271f] hover:bg-[#e2d4bd]'
                        )}
                      >
                        {crop}
                      </button>
                    ))}
                  </div>
                  {formData.crop_type.includes('其他') && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-2 font-medium">
                      請在第 3 步「補充備註」詳細填寫您實際施作的作物種類。
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <label htmlFor="area_value" className="block text-base font-bold text-[#20271f] mb-2">
                    預估面積 <span className="text-[#c0392b] text-sm">*</span>
                  </label>
                  <div className="flex gap-2 w-full">
                    <input
                      id="area_value"
                      type="number"
                      step="any"
                      min="0"
                      value={formData.area_value}
                      onChange={(e) => setFormData({ ...formData, area_value: e.target.value })}
                      placeholder="例如：3"
                      aria-invalid={!!stepErrors.area_value}
                      aria-describedby={stepErrors.area_value ? 'area_value-error' : undefined}
                      className="min-w-0 flex-1 min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                      required
                    />
                    <select
                      value={formData.area_unit}
                      onChange={(e) => setFormData({ ...formData, area_unit: e.target.value as AreaUnit })}
                      className="w-24 shrink-0 min-h-[48px] px-2.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-bold bg-white text-[#20271f] text-center cursor-pointer"
                    >
                      {AREA_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  {stepErrors.area_value && (
                    <div id="area_value-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.area_value}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 枝條數量 */}
              <div className="border border-[#e0d9cb] rounded-2xl p-4 bg-[#f8f3e7]/70">
                <label className="flex items-center gap-1.5 text-base font-bold text-[#20271f] mb-2">
                  <Layers className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                  <span>枝條數量</span>
                  <span className="text-[#856200] text-xs font-bold bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-full">必填</span>
                </label>
                <div className="space-y-2">
                  {BRANCH_VOLUME_OPTIONS.map((vol) => (
                    <label
                      key={vol}
                      onClick={() => setFormData({ ...formData, branch_volume: vol })}
                      className={'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition min-h-[48px] ' + (
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
                        <span className="text-base font-bold text-[#20271f]">{vol}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {stepErrors.branch_volume && (
                  <div id="branch_volume-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{stepErrors.branch_volume}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 步驟 2：地點與時段 */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-[#f0eae1] pb-3">
                <h2 
                  ref={stepHeadingRef} 
                  tabIndex={-1} 
                  className="text-lg font-bold text-[#173820] flex items-center gap-2 outline-none"
                >
                  <MapPin className="w-5 h-5 text-[#2a5937]" aria-hidden="true" />
                  步驟 2：施作地點與預約日期
                </h2>
                <p className="text-xs text-[#657061] mt-0.5">提供確切地點與偏好施工時段，服務站將排程調度</p>
              </div>

              {/* 施作地點 */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-base font-bold text-[#20271f]">
                  <MapPin className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                  施作地點 <span className="text-[#c0392b] text-sm">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    id="location_area"
                    value={formData.location_area}
                    onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
                    className="min-h-[48px] px-3 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                  >
                    {KAOHSIUNG_DISTRICTS.map((dist) => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                  <input
                    id="location_address"
                    type="text"
                    value={formData.location_address}
                    onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                    placeholder="地段/地號或詳細路名地標"
                    aria-invalid={!!stepErrors.location_address}
                    aria-describedby={stepErrors.location_address ? 'location_address-error' : undefined}
                    className="sm:col-span-2 min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                    required
                  />
                </div>
                {stepErrors.location_address && (
                  <div id="location_address-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{stepErrors.location_address}</span>
                  </div>
                )}
              </div>

              {/* 希望施工日期 */}
              <div className="space-y-3 pt-1">
                <div>
                  <label htmlFor="preferred_date" className="flex items-center gap-1.5 text-base font-bold text-[#20271f]">
                    <Calendar className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    希望施工日期 <span className="text-[#856200] text-xs font-bold bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-full">必填</span>
                  </label>
                  <input
                    id="preferred_date"
                    type="date"
                    min={availability?.window?.earliest || ''}
                    max={availability?.window?.latest || ''}
                    value={formData.preferred_date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData(prev => {
                        const dayAvail = availability?.dates?.[newDate];
                        let newSlot = prev.preferred_time_slot;
                        if (dayAvail) {
                          if (newSlot === 'morning' && !dayAvail.slots.morning) {
                            newSlot = dayAvail.slots.afternoon ? 'afternoon' : 'any';
                          } else if (newSlot === 'afternoon' && !dayAvail.slots.afternoon) {
                            newSlot = dayAvail.slots.morning ? 'morning' : 'any';
                          }
                        }
                        return { ...prev, preferred_date: newDate, preferred_time_slot: newSlot };
                      });
                    }}
                    aria-invalid={!!stepErrors.preferred_date}
                    aria-describedby={stepErrors.preferred_date ? 'preferred_date-error' : undefined}
                    className="w-full mt-1.5 min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                    required
                  />
                  <p className="text-xs text-[#2a5937] font-medium mt-1.5">
                    ℹ️ 此為希望服務時段，實際服務日期與開工時間將由服務站聯絡確認。
                  </p>
                  {stepErrors.preferred_date && (
                    <div id="preferred_date-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.preferred_date}</span>
                    </div>
                  )}
                  {formData.preferred_date && selectedDateAvailability && !selectedDateAvailability.selectable && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>此日期服務站目前未開放或已額滿，請選擇其他希望日期。</span>
                    </div>
                  )}
                </div>

                {/* 偏好時段 */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-[#657061] mb-1.5">
                    <Clock className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    偏好時段（上午／下午／都可以）
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        value: 'morning',
                        label: '上午',
                        disabled: selectedDateAvailability ? !selectedDateAvailability.slots.morning : false,
                        badge: selectedDateAvailability && !selectedDateAvailability.slots.morning
                          ? (selectedDateAvailability.reasons.morning === 'reserved' ? '已預約' : '額滿')
                          : null
                      },
                      {
                        value: 'afternoon',
                        label: '下午',
                        disabled: selectedDateAvailability ? !selectedDateAvailability.slots.afternoon : false,
                        badge: selectedDateAvailability && !selectedDateAvailability.slots.afternoon
                          ? (selectedDateAvailability.reasons.afternoon === 'reserved' ? '已預約' : '額滿')
                          : null
                      },
                      {
                        value: 'any',
                        label: '都可以',
                        disabled: selectedDateAvailability ? !selectedDateAvailability.slots.any : false,
                        badge: selectedDateAvailability && !selectedDateAvailability.slots.any ? '不可選' : null
                      }
                    ].map((slot) => {
                      const isSelected = formData.preferred_time_slot === slot.value;
                      return (
                        <button
                          type="button"
                          key={slot.value}
                          disabled={slot.disabled}
                          onClick={() => setFormData({ ...formData, preferred_time_slot: slot.value as TimeSlot })}
                          className={'min-h-[48px] py-2 px-1 text-sm font-semibold rounded-xl border transition flex flex-col items-center justify-center ' + (
                            slot.disabled
                              ? 'border-[#e0d9cb] bg-[#f3efe6] text-[#9ca3af] cursor-not-allowed opacity-60'
                              : isSelected
                                ? 'bg-[#2a5937] text-white border-[#2a5937] font-bold shadow-sm'
                                : 'border-[#d8d1c3] bg-white text-[#20271f] hover:bg-[#f8f3e7]'
                          )}
                        >
                          <span>{slot.label}</span>
                          {slot.badge && (
                            <span className="text-[10px] text-red-500 font-normal">({slot.badge})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {stepErrors.preferred_time_slot && (
                    <div id="preferred_time_slot-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.preferred_time_slot}</span>
                    </div>
                  )}
                </div>

                {/* 日期彈性 */}
                <div className="border border-[#e0d9cb] rounded-2xl p-4 bg-[#f8f3e7]/70 mt-3">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#20271f] mb-2">
                    <CalendarClock className="w-3.5 h-3.5 text-[#2a5937]" aria-hidden="true" />
                    日期彈性 <span className="text-[#657061] text-[11px] font-normal bg-[#e0d9cb]/60 px-2 py-0.5 rounded-full">選填</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {DATE_FLEXIBILITY_OPTIONS.map((flex) => (
                      <label
                        key={flex}
                        onClick={() => setFormData({ ...formData, date_flexibility: flex })}
                        className={'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition min-h-[44px] ' + (
                          formData.date_flexibility === flex
                            ? 'bg-[#f5faf2] border-[#2a5937] ring-1 ring-[#2a5937]'
                            : 'bg-[#fffdf7] border-[#d8d1c3] hover:bg-[#f8f3e7]'
                        )}
                      >
                        <span className="text-xs font-bold text-[#20271f]">{flex}</span>
                        <span className={'w-4 h-4 rounded-full border flex items-center justify-center ' + (
                          formData.date_flexibility === flex ? 'border-[#2a5937]' : 'border-[#bfb8aa]'
                        )}>
                          {formData.date_flexibility === flex && <span className="w-2.5 h-2.5 rounded-full bg-[#2a5937]" />}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 步驟 3：聯絡資料 */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-[#f0eae1] pb-3">
                <h2 
                  ref={stepHeadingRef} 
                  tabIndex={-1} 
                  className="text-lg font-bold text-[#173820] flex items-center gap-2 outline-none"
                >
                  <User className="w-5 h-5 text-[#2a5937]" aria-hidden="true" />
                  步驟 3：填寫聯絡方式與備註
                </h2>
                <p className="text-xs text-[#657061] mt-0.5">請提供方便聯繫的手機或市話，以利人員去電確認</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact_name" className="flex items-center gap-1.5 text-base font-bold text-[#20271f] mb-1.5">
                    <User className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    聯絡姓名 <span className="text-[#c0392b] text-sm">*</span>
                  </label>
                  <input
                    id="contact_name"
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="請輸入姓名"
                    aria-invalid={!!stepErrors.contact_name}
                    aria-describedby={stepErrors.contact_name ? 'contact_name-error' : undefined}
                    className="w-full min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                    required
                  />
                  {stepErrors.contact_name && (
                    <div id="contact_name-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.contact_name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="flex items-center gap-1.5 text-base font-bold text-[#20271f] mb-1.5">
                    <Phone className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    聯絡電話 <span className="text-[#c0392b] text-sm">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="手機 09xx (10碼) 或 市話 02~08 (9碼)"
                    maxLength={14}
                    aria-invalid={!!stepErrors.phone}
                    aria-describedby={stepErrors.phone ? 'phone-error' : undefined}
                    className="w-full min-h-[48px] px-3.5 py-2.5 border border-[#bfb8aa] rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:border-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f]"
                    required
                  />
                  <p className="text-[11px] text-[#657061] mt-1">
                    格式支援：09 開頭 10 碼手機，或 02-08 開頭 9 碼市話數字
                  </p>
                  {stepErrors.phone && (
                    <div id="phone-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{stepErrors.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-semibold text-[#657061] mb-1">
                  補充備註 {formData.crop_type.includes('其他') ? <span className="text-[#c0392b] font-bold">（第一步選擇其他作物，請在此填寫作物種類 *）</span> : '(選填)'}
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={formData.crop_type.includes('其他') ? "請在此填寫作物種類，以及進出路況、水源等特殊需求" : "若有特殊進出路況（如山路窄巷）、水源位置或其他需求可在此註明"}
                  rows={3}
                  aria-invalid={!!stepErrors.notes}
                  aria-describedby={stepErrors.notes ? 'notes-error' : undefined}
                  className={'w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-[#2a5937] focus:outline-none text-base font-medium bg-white text-[#20271f] ' + (
                    formData.crop_type.includes('其他') ? 'border-amber-400 focus:border-amber-500' : 'border-[#bfb8aa] focus:border-[#2a5937]'
                  )}
                />
                {stepErrors.notes && (
                  <div id="notes-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{stepErrors.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 步驟 4：核對送出（長者最安心的確認頁） */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="border-b border-[#f0eae1] pb-3">
                <h2 
                  ref={stepHeadingRef} 
                  tabIndex={-1} 
                  className="text-lg font-bold text-[#173820] flex items-center gap-2 outline-none"
                >
                  <ShieldCheck className="w-5 h-5 text-[#2a5937]" aria-hidden="true" />
                  步驟 4：核對申請內容並送出
                </h2>
                <p className="text-xs text-[#657061] mt-0.5">請確認以下填寫資料正確無誤，點擊「修改」可直接更正該區塊</p>
              </div>

              {/* 摘要卡片 1：需求項目 */}
              <div className="border border-[#e0d9cb] bg-[#fffdf7] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#f0eae1] mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#173820]">
                    <Sprout className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    需求項目
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToEdit(1)}
                    className="text-xs text-[#2a5937] hover:text-[#173820] font-bold flex items-center gap-1 px-2.5 py-1 bg-[#dcebd6]/50 hover:bg-[#dcebd6] rounded-lg transition"
                  >
                    <Edit3 className="w-3 h-3" aria-hidden="true" />
                    修改
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <span className="text-[#657061] text-xs block">服務項目</span>
                    <strong className="text-[#20271f] font-bold">{formData.service_type}</strong>
                  </div>
                  <div>
                    <span className="text-[#657061] text-xs block">作物種類</span>
                    <strong className="text-[#20271f] font-bold">{formData.crop_type}</strong>
                  </div>
                  <div>
                    <span className="text-[#657061] text-xs block">預估面積</span>
                    <strong className="text-[#20271f] font-bold">{formData.area_value} {formData.area_unit}</strong>
                  </div>
                  <div>
                    <span className="text-[#657061] text-xs block">枝條數量</span>
                    <strong className="text-[#20271f] font-bold">{formData.branch_volume}</strong>
                  </div>
                </div>
              </div>

              {/* 摘要卡片 2：地點與時段 */}
              <div className="border border-[#e0d9cb] bg-[#fffdf7] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#f0eae1] mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#173820]">
                    <MapPin className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    施作地點與時段
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToEdit(2)}
                    className="text-xs text-[#2a5937] hover:text-[#173820] font-bold flex items-center gap-1 px-2.5 py-1 bg-[#dcebd6]/50 hover:bg-[#dcebd6] rounded-lg transition"
                  >
                    <Edit3 className="w-3 h-3" aria-hidden="true" />
                    修改
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-[#657061] text-xs block">施作地點</span>
                    <strong className="text-[#20271f] font-bold">{formData.location_area} - {formData.location_address}</strong>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[#657061] text-xs block">希望施工日期</span>
                      <strong className="text-[#20271f] font-bold">{formData.preferred_date || '未選擇'}</strong>
                    </div>
                    <div>
                      <span className="text-[#657061] text-xs block">偏好時段</span>
                      <strong className="text-[#20271f] font-bold">
                        {formData.preferred_time_slot === 'morning' ? '上午' : formData.preferred_time_slot === 'afternoon' ? '下午' : '都可以'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#657061] text-xs block">日期彈性</span>
                      <strong className="text-[#20271f] font-bold">{formData.date_flexibility}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 摘要卡片 3：聯絡資料 */}
              <div className="border border-[#e0d9cb] bg-[#fffdf7] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#f0eae1] mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#173820]">
                    <User className="w-4 h-4 text-[#2a5937]" aria-hidden="true" />
                    聯絡人資料
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToEdit(3)}
                    className="text-xs text-[#2a5937] hover:text-[#173820] font-bold flex items-center gap-1 px-2.5 py-1 bg-[#dcebd6]/50 hover:bg-[#dcebd6] rounded-lg transition"
                  >
                    <Edit3 className="w-3 h-3" aria-hidden="true" />
                    修改
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#657061] text-xs block">聯絡姓名</span>
                      <strong className="text-[#20271f] font-bold">{formData.contact_name}</strong>
                    </div>
                    <div>
                      <span className="text-[#657061] text-xs block">聯絡電話</span>
                      <strong className="text-[#20271f] font-bold">{formData.phone}</strong>
                    </div>
                  </div>
                  {formData.notes && (
                    <div className="pt-1">
                      <span className="text-[#657061] text-xs block">補充備註</span>
                      <p className="text-[#20271f] bg-[#f8f3e7] p-2 rounded-lg text-xs mt-0.5 whitespace-pre-wrap">{formData.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cloudflare Turnstile 隱形無感安全驗證容器 */}
              <div ref={turnstileContainerRef}></div>
              <div className="flex items-center justify-center -mt-1">
                <p className="text-[11px] text-[#657061] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2a5937]" aria-hidden="true" />
                  由 Cloudflare Turnstile 提供安全防護
                </p>
              </div>

              {turnstileStatus && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-medium" role="alert" aria-live="polite">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{turnstileStatus}</span>
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl font-semibold" role="alert" aria-live="assertive">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 底部導覽按鈕列 (上一步、下一步 / 返回核對 / 確認送出) */}
          {/* ======================================================== */}
          <div className="pt-4 border-t border-[#e0d9cb] flex items-center gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={isSubmitting}
                className="min-h-[48px] px-4 py-3 bg-[#f8f3e7] hover:bg-[#e0d9cb] border border-[#bfb8aa] text-[#20271f] font-bold text-base rounded-xl transition flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span>上一步</span>
              </button>
            )}

            {currentStep < 4 ? (
              <button
                key="btn-next-step"
                type="button"
                onClick={handleNext}
                className="flex-1 min-h-[48px] py-3.5 px-4 bg-[#2a5937] hover:bg-[#173820] active:scale-[0.99] text-white font-bold text-base rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
              >
                {returnToReview ? (
                  <>
                    <span>完成修改，返回核對</span>
                    <Check className="w-5 h-5" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <span>下一步</span>
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </>
                )}
              </button>
            ) : (
              <button
                key="btn-submit-step"
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 min-h-[48px] py-3.5 px-4 bg-[#2a5937] hover:bg-[#173820] active:scale-[0.99] text-white font-bold text-base rounded-xl transition shadow-lg shadow-[#2a5937]/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>送出中...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    <span>確認送出申請</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 表單底部輔助列：清空草稿按鈕（移至底部防誤觸） */}
          {draftSaved && currentStep < 4 && (
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-xs text-[#8c9489] hover:text-red-700 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>清空並重新填寫</span>
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};
