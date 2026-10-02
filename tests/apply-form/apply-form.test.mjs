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

