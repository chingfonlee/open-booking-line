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
 * 檢查表單草稿是否具備實質的使用者自訂內容。
 * 避免僅含有系統下拉選單預設值（例如整枝修剪、棗子、分、中量等）的空表單被誤判為草稿，
 * 徹底防止使用者每次打開頁面皆誤跳「上次未填寫完畢」彈窗。
 */
export function hasMeaningfulDraftContent(formData?: Partial<CreateServiceRequestDto> | null): boolean {
  if (!formData) return false;
  const hasName = Boolean(formData.contact_name && formData.contact_name.trim().length > 0);
  const hasPhone = Boolean(formData.phone && formData.phone.trim().length > 0);
  const hasAddress = Boolean(formData.location_address && formData.location_address.trim().length > 0);
  const hasAreaValue = Boolean(formData.area_value && formData.area_value.trim().length > 0);
  const hasDate = Boolean(formData.preferred_date && formData.preferred_date.trim().length > 0);
  const hasNotes = Boolean(formData.notes && formData.notes.trim().length > 0);

  return hasName || hasPhone || hasAddress || hasAreaValue || hasDate || hasNotes;
}

/**
 * 安全儲存表單草稿至 localStorage。
 * 僅在使用者已輸入實質內容時進行儲存；若為完全預設之空表單則略過，避免產生無效草稿。
 * @returns boolean 成功寫入傳回 true，失敗或無實質內容傳回 false
 */
export function saveFormDraft(formData: Partial<CreateServiceRequestDto>, step: number): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  if (!hasMeaningfulDraftContent(formData)) {
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
 * 檢查版本號相容性、7 天保存期限、以及是否具備實質使用者輸入內容。
 * 若逾期、異常或僅為預設空表單，則自動清理並傳回 null。
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

    // 檢查是否具有使用者實際填寫的內容（防範空白預設表單誤觸彈窗）
    if (!hasMeaningfulDraftContent(envelope.formData)) {
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
