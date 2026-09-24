// Cloudflare Turnstile 無感驗證核心模組
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<{ success: boolean; errorCodes?: string[] }> {
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  // 測試金鑰容錯 (Cloudflare 官方 Dummy 測試環境)
  if (secretKey === '1x0000000000000000000000000000000AA' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
    return { success: true };
  }

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
      errorCodes: data['error-codes']
    };
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return { success: false, errorCodes: ['internal-error'] };
  }
}
