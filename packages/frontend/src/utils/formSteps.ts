import type { CreateServiceRequestDto, AvailabilityResponse } from '../../../shared/types';
import { validateStep1, validateStep2, validateStep3 } from './formValidation.ts';

export const STEPS = [
  { id: 1, name: '需求項目' },
  { id: 2, name: '地點時段' },
  { id: 3, name: '聯絡資料' },
  { id: 4, name: '核對送出' }
] as const;

/**
 * 依據當前已填寫的資料，推算第一個未完成的步驟 (1~4)。
 * 防止使用者直接在網址輸入 #step-3 或 #step-4 繞過前面步驟。
 */
export function getFirstIncompleteStep(
  formData: Partial<CreateServiceRequestDto>,
  availability?: AvailabilityResponse | null,
  blockedDates: string[] = []
): number {
  if (!validateStep1(formData).isValid) {
    return 1;
  }
  if (!validateStep2(formData, availability, blockedDates).isValid) {
    return 2;
  }
  if (!validateStep3(formData).isValid) {
    return 3;
  }
  return 4;
}

/**
 * 判定目標步驟是否允許直接跳轉前往。
 * 若尚未完成前置步驟，強制導正回第一個未完成步驟。
 */
export function sanitizeTargetStep(
  targetStep: number,
  formData: Partial<CreateServiceRequestDto>,
  availability?: AvailabilityResponse | null,
  blockedDates: string[] = []
): number {
  const clamped = Math.min(Math.max(targetStep, 1), 4);
  const firstIncomplete = getFirstIncompleteStep(formData, availability, blockedDates);
  if (clamped > firstIncomplete) {
    return firstIncomplete;
  }
  return clamped;
}

/**
 * 計算下一步的目標步驟號。
 * 若為「從確認頁點選修改」（returnToReview = true），直接返回步驟 4。
 */
export function getNextStepNumber(currentStep: number, returnToReview: boolean): number {
  if (returnToReview) {
    return 4;
  }
  return Math.min(currentStep + 1, 4);
}

/**
 * 步驟切換至確認頁之防誤觸冷卻時間（毫秒）
 * 防止使用者在步驟 3 連點兩次「下一步」或 Enter 鍵穿透導致誤觸送單
 */
export const SUBMISSION_COOLDOWN_MS = 500;

/**
 * 判斷當前是否具備合法送出表單的資格
 * 1. 必須嚴格處於步驟 4（確認核對頁）
 * 2. 目前不可處於送出中狀態 (isSubmitting)
 * 3. 進入步驟 4 必須超過冷卻安全時間 (SUBMISSION_COOLDOWN_MS)
 */
export function canSubmitForm(
  currentStep: number,
  isSubmitting: boolean,
  lastStepChangeTime: number,
  now: number = Date.now()
): boolean {
  if (currentStep !== 4) {
    return false;
  }
  if (isSubmitting) {
    return false;
  }
  if (now - lastStepChangeTime < SUBMISSION_COOLDOWN_MS) {
    return false;
  }
  return true;
}

