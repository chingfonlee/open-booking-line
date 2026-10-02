import type { CreateServiceRequestDto } from '../../../shared/types';

export const DRAFT_STORAGE_KEY = 'xingnong_apply_form_draft_v1';
export const DRAFT_VERSION = 1;
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天過期

export interface FormDraftEnvelope {
  version: number;
  savedAt: number;
  step: number;
  formData: Partial<CreateServiceRequestDto>;
}

/**
 * 安全儲存表單草稿至 localStorage。
 * 嚴格使用 try/catch 攔截各類瀏覽器異常（QuotaExceeded、Safari 私密瀏覽、第三方禁用等）。
 * @returns boolean 成功寫入傳回 true，失敗傳回 false
 */
export function saveFormDraft(formData: Partial<CreateServiceRequestDto>, step: number): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const envelope: FormDraftEnvelope = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      step: Math.min(Math.max(step, 1), 4),
      formData: { ...formData }
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全載入 localStorage 中的草稿。
 * 檢查版本號相容性與 7 天保存期限，若逾期或異常則自動清理並傳回 null。
 */
export function loadFormDraft(): { formData: Partial<CreateServiceRequestDto>; step: number; savedAt: number } | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const envelope: FormDraftEnvelope = JSON.parse(raw);
    if (!envelope || envelope.version !== DRAFT_VERSION) {
      clearFormDraft();
      return null;
    }

    // 檢查 7 天過期期限
    const age = Date.now() - (envelope.savedAt || 0);
    if (age > DRAFT_MAX_AGE_MS || age < 0) {
      clearFormDraft();
      return null;
    }

    return {
      formData: envelope.formData || {},
      step: Math.min(Math.max(envelope.step || 1, 1), 4),
      savedAt: envelope.savedAt || Date.now()
    };
  } catch {
    clearFormDraft();
    return null;
  }
}

/**
 * 清除草稿資料
 */
export function clearFormDraft(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
