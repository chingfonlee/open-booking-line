/**
 * Cloudflare Turnstile 無感驗證核心模組 (Smart Dual-Mode 雙軌智慧防禦)
 * 
 * 軌道一 (Starter / 體驗模式)：
 * 預設使用 Cloudflare 官方測試金鑰 (1x0000000000000000000000000000000AA)。
 * 供新手初次安裝、展示或本機開發時 0 門檻開箱即測，不增加任何初期部署負擔。
 * 
 * 軌道二 (Production / 生產加固模式)：
 * 一旦管理者在 Worker 配置真實 Turnstile 密鑰 (非 1x/2x/3x 官方測試前綴)：
 * 1. 自動且強制啟用 Fail-Closed 鋼鐵防禦！
 * 2. 嚴格封殺任何虛擬測試 Token (XXXX.DUMMY.TOKEN.XXXX)。
 * 3. 強制調用 Cloudflare 官方 siteverify 進行伺服器端簽章驗證，驗證未過一律 403 阻擋。
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<{ success: boolean; errorCodes?: string[]; isTestMode?: boolean }> {
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  // 判斷是否為 Cloudflare 官方測試用 Dummy Secret (1x/2x/3x 開頭)
  const isOfficialTestSecret = !secretKey || secretKey.startsWith('1x') || secretKey.startsWith('2x') || secretKey.startsWith('3x');

  // =========================================================================
  // 軌道一：Starter 體驗模式 (採用官方測試密鑰，新手開箱即測)
  // =========================================================================
  if (isOfficialTestSecret) {
    console.warn('⚠️ [Turnstile Notice] 系統目前運行於 Starter 測試模式 (Always-Pass)。正式投入商轉時請至 Cloudflare 後台申請真實 Turnstile Widget 並填入真實金鑰！');

    if (secretKey === '1x0000000000000000000000000000000AA' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
      return { success: true, isTestMode: true };
    }
  }

  // =========================================================================
  // 軌道二：Production 生產防禦模式 (配置真實金鑰，強制 Fail-Closed 鋼鐵防禦)
  // =========================================================================
  // 1. 嚴格阻絕：一旦進入生產模式，任何測試虛擬 Token 立即直接封鎖！
  if (token === 'XXXX.DUMMY.TOKEN.XXXX') {
    console.warn('⛔ [Turnstile Security Alert] 生產模式拒絕測試 Token (Dummy token rejected in production)');
    return { success: false, errorCodes: ['dummy-token-forbidden-in-production'] };
  }

  // 2. 密鑰防空檢查 (Fail-Closed)
  if (!secretKey) {
    console.error('⛔ [Turnstile Security Error] 生產模式未配置 TURNSTILE_SECRET_KEY');
    return { success: false, errorCodes: ['missing-secret-key-in-production'] };
  }

  // 3. 呼叫 Cloudflare 官方 siteverify 進行後端密碼學驗證
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp && remoteIp !== 'unknown') {
      formData.append('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString(),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const data = (await res.json()) as any;
    return {
      success: !!data.success,
      errorCodes: data['error-codes'],
      isTestMode: false
    };
  } catch (err) {
    console.error('Turnstile verification network error:', err);
    // 依據 Fail-Closed 原則，網路或伺服器驗證異常時拒絕放行
    return { success: false, errorCodes: ['internal-error'] };
  }
}
