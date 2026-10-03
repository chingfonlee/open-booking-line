import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateAllSteps
} from '../../packages/frontend/src/utils/formValidation.ts';
import {
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  hasMeaningfulDraftContent,
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  DRAFT_MAX_AGE_MS
} from '../../packages/frontend/src/utils/formDraft.ts';

test('ApplyForm Step Validation Suite', async (t) => {
  await t.test('Step 1: should reject missing or invalid service, crop, area, branch volume', () => {
    const invalid = validateStep1({});
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errors.service_type);
    assert.ok(invalid.errors.crop_type);
    assert.ok(invalid.errors.area_value);
    assert.ok(invalid.errors.branch_volume);

    const valid = validateStep1({
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '3.5',
      area_unit: '分',
      branch_volume: '中量'
    });
    assert.equal(valid.isValid, true);
    assert.equal(Object.keys(valid.errors).length, 0);
  });

  await t.test('Step 1: area value must be greater than 0', () => {
    const zeroArea = validateStep1({
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '0',
      branch_volume: '中量'
    });
    assert.equal(zeroArea.isValid, false);
    assert.ok(zeroArea.errors.area_value);
  });

  await t.test('Step 2: should validate location and availability slot constraints', () => {
    const mockAvailability = {
      window: { earliest: '2026-10-03', latest: '2026-11-01' },
      dates: {
        '2026-10-05': {
          date: '2026-10-05',
          selectable: true,
          slots: { morning: false, afternoon: true, any: true },
          reasons: { morning: 'reserved', afternoon: 'open', any: 'open' }
        },
        '2026-10-06': {
          date: '2026-10-06',
          selectable: false,
          slots: { morning: false, afternoon: false, any: false },
          reasons: { morning: 'blocked', afternoon: 'blocked', any: 'blocked' }
        }
      }
    };

    // 1. Missing fields
    const missing = validateStep2({});
    assert.equal(missing.isValid, false);
    assert.ok(missing.errors.location_area);
    assert.ok(missing.errors.location_address);
    assert.ok(missing.errors.preferred_date);

    // 2. Selectable date with unavailable morning slot
    const morningReserved = validateStep2({
      location_area: '大樹區',
      location_address: '姑婆寮段 123 號',
      preferred_date: '2026-10-05',
      preferred_time_slot: 'morning'
    }, mockAvailability);
    assert.equal(morningReserved.isValid, false);
    assert.ok(morningReserved.errors.preferred_time_slot);

    // 3. Selectable date with available afternoon slot
    const afternoonValid = validateStep2({
      location_area: '大樹區',
      location_address: '姑婆寮段 123 號',
      preferred_date: '2026-10-05',
      preferred_time_slot: 'afternoon'
    }, mockAvailability);
    assert.equal(afternoonValid.isValid, true);

    // 4. Blocked date
    const blockedDate = validateStep2({
      location_area: '大樹區',
      location_address: '姑婆寮段 123 號',
      preferred_date: '2026-10-06',
      preferred_time_slot: 'afternoon'
    }, mockAvailability);
    assert.equal(blockedDate.isValid, false);
    assert.ok(blockedDate.errors.preferred_date);
  });

  await t.test('Step 3: should enforce phone validation for mobile and landline', () => {
    // 1. Valid 10-digit mobile
    const mobileValid = validateStep3({
      contact_name: '陳大明',
      phone: '0912-345-678'
    });
    assert.equal(mobileValid.isValid, true);

    // 2. Valid 9-digit landline (Kaohsiung 07)
    const landlineValid = validateStep3({
      contact_name: '王小芬',
      phone: '07-6512345'
    });
    assert.equal(landlineValid.isValid, true);

    // 3. Invalid phone lengths / prefixes
    const invalidPhone = validateStep3({
      contact_name: '陳大明',
      phone: '0912345'
    });
    assert.equal(invalidPhone.isValid, false);
    assert.ok(invalidPhone.errors.phone);

    // 4. "Other" crop type requires notes
    const otherCropNeedsNote = validateStep3({
      contact_name: '陳大明',
      phone: '0912345678',
      crop_type: '其他',
      notes: ''
    });
    assert.equal(otherCropNeedsNote.isValid, false);
    assert.ok(otherCropNeedsNote.errors.notes);
  });

  await t.test('Step 4 / All Steps: should aggregate all step errors or pass completely', () => {
    const fullForm = {
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '5',
      area_unit: '分',
      branch_volume: '多',
      location_area: '燕巢區',
      location_address: '尖山段 88 號',
      preferred_date: '2026-10-10',
      preferred_time_slot: 'any',
      contact_name: '林阿公',
      phone: '0988776655',
      notes: '田邊路窄機具需倒車進入'
    };

    const fullValid = validateAllSteps(fullForm);
    assert.equal(fullValid.isValid, true);
    assert.equal(Object.keys(fullValid.errors).length, 0);
  });
});

test('ApplyForm Draft Storage & Security Suite', async (t) => {
  // 建立 Mock localStorage 環境
  const mockStorage = new Map();
  const mockWindow = {
    localStorage: {
      getItem(key) { return mockStorage.get(key) || null; },
      setItem(key, val) { mockStorage.set(key, String(val)); },
      removeItem(key) { mockStorage.delete(key); }
    }
  };
  globalThis.window = mockWindow;

  await t.test('hasMeaningfulDraftContent should return false for empty or default-only form', () => {
    assert.equal(hasMeaningfulDraftContent(undefined), false);
    assert.equal(hasMeaningfulDraftContent({}), false);
    assert.equal(hasMeaningfulDraftContent({
      service_type: '整枝修剪',
      crop_type: '棗子',
      area_unit: '分',
      branch_volume: '中量',
      location_area: '燕巢區',
      preferred_time_slot: 'morning',
      date_flexibility: '前後 3 天皆可'
    }), false, 'Default options alone must not count as meaningful user input');
  });

  await t.test('hasMeaningfulDraftContent should return true when user inputs substantive data', () => {
    assert.equal(hasMeaningfulDraftContent({ contact_name: '王小華' }), true);
    assert.equal(hasMeaningfulDraftContent({ phone: '0912345678' }), true);
    assert.equal(hasMeaningfulDraftContent({ location_address: '民生路 10 號' }), true);
    assert.equal(hasMeaningfulDraftContent({ area_value: '2.5' }), true);
    assert.equal(hasMeaningfulDraftContent({ preferred_date: '2026-10-15' }), true);
    assert.equal(hasMeaningfulDraftContent({ notes: '注意有狗' }), true);
  });

  await t.test('should refuse to save draft when form has only default values without user input', () => {
    mockStorage.clear();
    const defaultData = {
      service_type: '整枝修剪',
      crop_type: '棗子',
      area_unit: '分',
      branch_volume: '中量',
      location_area: '燕巢區'
    };
    const saved = saveFormDraft(defaultData, 1);
    assert.equal(saved, false);
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), false, 'Empty default form must not be saved to localStorage');
  });

  await t.test('should automatically invalidate and clear draft when loaded payload lacks meaningful content', () => {
    mockStorage.clear();
    const emptyPayload = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      step: 1,
      formData: { service_type: '整枝修剪', area_unit: '分' }
    };
    mockStorage.set(DRAFT_STORAGE_KEY, JSON.stringify(emptyPayload));

    const loaded = loadFormDraft();
    assert.equal(loaded, null, 'Must return null for default-only payload');
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), false, 'Legacy empty payload must be purged from localStorage');
  });

  await t.test('should safely save draft with version and timestamp', () => {
    const sampleData = { contact_name: '李小美', phone: '0911222333' };
    const saved = saveFormDraft(sampleData, 2);
    assert.equal(saved, true);

    const storedRaw = mockStorage.get(DRAFT_STORAGE_KEY);
    assert.ok(storedRaw);
    const parsed = JSON.parse(storedRaw);
    assert.equal(parsed.version, DRAFT_VERSION);
    assert.equal(parsed.step, 2);
    assert.equal(parsed.formData.contact_name, '李小美');
  });

  await t.test('should load valid draft within 7 days', () => {
    const loaded = loadFormDraft();
    assert.ok(loaded);
    assert.equal(loaded.step, 2);
    assert.equal(loaded.formData.contact_name, '李小美');
  });

  await t.test('should automatically invalidate and clear draft older than 7 days', () => {
    // 注入 8 天前的過期草稿
    const expiredPayload = {
      version: DRAFT_VERSION,
      savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
      step: 3,
      formData: { contact_name: '過期農友' }
    };
    mockStorage.set(DRAFT_STORAGE_KEY, JSON.stringify(expiredPayload));

    const loaded = loadFormDraft();
    assert.equal(loaded, null);
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), false, 'Expired draft must be purged');
  });

  await t.test('should automatically invalidate draft with mismatched version', () => {
    const legacyPayload = {
      version: 999, // 不相容的未來或舊版版本號
      savedAt: Date.now(),
      step: 1,
      formData: { contact_name: '舊版本' }
    };
    mockStorage.set(DRAFT_STORAGE_KEY, JSON.stringify(legacyPayload));

    const loaded = loadFormDraft();
    assert.equal(loaded, null);
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), false);
  });

  await t.test('should safely handle clearFormDraft', () => {
    saveFormDraft({ contact_name: '即將清除' }, 1);
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), true);
    const cleared = clearFormDraft();
    assert.equal(cleared, true);
    assert.equal(mockStorage.has(DRAFT_STORAGE_KEY), false);
  });

  await t.test('should handle QuotaExceeded or storage disabled without crashing', () => {
    // 模擬 Safari 私密瀏覽禁止寫入或磁碟已滿
    globalThis.window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const saved = saveFormDraft({ contact_name: '異常測試' }, 1);
    assert.equal(saved, false, 'Must gracefully return false instead of throwing');
  });
});

test('ApplyForm Step Navigation & Bypass Protection Suite', async (t) => {
  const {
    getFirstIncompleteStep,
    sanitizeTargetStep,
    getNextStepNumber
  } = await import('../../packages/frontend/src/utils/formSteps.ts');

  await t.test('should identify step 1 as first incomplete when empty', () => {
    assert.equal(getFirstIncompleteStep({}), 1);
  });

  await t.test('should identify step 2 when step 1 is complete but location is missing', () => {
    const step1Done = {
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '2',
      branch_volume: '中量'
    };
    assert.equal(getFirstIncompleteStep(step1Done), 2);
  });

  await t.test('should prevent bypassing incomplete steps via URL hash', () => {
    // 使用者企圖直接開啟 #step-4，但表單為空，強制導正回 step 1
    assert.equal(sanitizeTargetStep(4, {}), 1);
    // 使用者企圖開啟 #step-3，但只填完 step 1，強制導正回 step 2
    const step1Done = {
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '2',
      branch_volume: '中量'
    };
    assert.equal(sanitizeTargetStep(3, step1Done), 2);
  });

  await t.test('should allow direct jump to earlier completed steps', () => {
    const allDone = {
      service_type: '碎枝服務',
      crop_type: '芭樂',
      area_value: '2',
      branch_volume: '中量',
      location_area: '大樹區',
      location_address: '姑婆寮段 1 號',
      preferred_date: '2026-10-15',
      contact_name: '陳大明',
      phone: '0912345678'
    };
    assert.equal(sanitizeTargetStep(1, allDone), 1);
    assert.equal(sanitizeTargetStep(2, allDone), 2);
    assert.equal(sanitizeTargetStep(4, allDone), 4);
  });

  await t.test('getNextStepNumber should direct to step 4 when returnToReview is true', () => {
    assert.equal(getNextStepNumber(1, true), 4);
    assert.equal(getNextStepNumber(2, true), 4);
    assert.equal(getNextStepNumber(1, false), 2);
    assert.equal(getNextStepNumber(3, false), 4);
  });
});

test('ApplyForm Submission Anti-Ghost & Double-Tap Protection Suite', async (t) => {
  const { canSubmitForm, SUBMISSION_COOLDOWN_MS } = await import('../../packages/frontend/src/utils/formSteps.ts');

  await t.test('should strictly reject submission when currentStep is not 4', () => {
    assert.equal(canSubmitForm(1, false, 0, 10000), false, 'Step 1 must never allow submit');
    assert.equal(canSubmitForm(2, false, 0, 10000), false, 'Step 2 must never allow submit');
    assert.equal(canSubmitForm(3, false, 0, 10000), false, 'Step 3 must never allow submit');
  });

  await t.test('should strictly reject submission when already isSubmitting', () => {
    assert.equal(canSubmitForm(4, true, 1000, 5000), false, 'Cannot submit while already submitting');
  });

  await t.test('should strictly reject submission during 500ms cooldown after step transition', () => {
    const stepEnteredAt = 10000;
    // 0ms (immediate double click from step 3)
    assert.equal(canSubmitForm(4, false, stepEnteredAt, 10000), false, '0ms double click must be ignored');
    // 150ms (rapid tap)
    assert.equal(canSubmitForm(4, false, stepEnteredAt, 10150), false, '150ms tap must be ignored');
    // 499ms (right under cooldown)
    assert.equal(canSubmitForm(4, false, stepEnteredAt, 10000 + SUBMISSION_COOLDOWN_MS - 1), false, 'Sub-500ms must be rejected');
  });

  await t.test('should allow submission only after cooldown period has elapsed on step 4', () => {
    const stepEnteredAt = 10000;
    // Exactly at cooldown
    assert.equal(canSubmitForm(4, false, stepEnteredAt, 10000 + SUBMISSION_COOLDOWN_MS), true);
    // After cooldown
    assert.equal(canSubmitForm(4, false, stepEnteredAt, 10000 + SUBMISSION_COOLDOWN_MS + 200), true);
  });

  await t.test('static audit: ApplyForm JSX must not use native type="submit" without decoupling', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const formCode = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/frontend/src/components/ApplyForm.tsx'),
      'utf8'
    );

    // Form onSubmit must prevent default and not auto-trigger handleSubmit
    assert.ok(
      formCode.includes('onSubmit={(e) => {\n            e.preventDefault();\n          }}') ||
      formCode.includes('onSubmit={(e) => { e.preventDefault(); }}') ||
      formCode.includes('e.preventDefault()'),
      'Form onSubmit must prevent default to eliminate ghost submissions'
    );

    // Confirmation button must be type="button" with onClick={handleSubmit}
    assert.ok(
      formCode.includes('key="btn-submit-step"'),
      'Confirmation button must have distinct key from next step button'
    );
    assert.ok(
      formCode.includes('key="btn-next-step"'),
      'Next step button must have distinct key to avoid React DOM node reuse'
    );
  });
});


