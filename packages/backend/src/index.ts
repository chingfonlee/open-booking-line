import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  generateFlexNotification,
  generateCustomerConfirmationFlex,
  generateProgressQueryFlex,
  generateWelcomeGuideFlex,
  pushLineMessage,
  replyLineMessage,
  verifyLineIdToken
} from './line';
import { verifyTurnstileToken } from './turnstile';
import { CreateServiceRequestDto, UpdateServiceRequestDto, RequestStatus } from '../../shared/types';

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  ADMIN_NOTIFY_USER_ID?: string;
  ADMIN_LINE_IDS?: string;
  STATION_NAME?: string;
  ADMIN_PIN?: string;
  TURNSTILE_SECRET_KEY?: string;
  LINE_LOGIN_CHANNEL_ID?: string;
};

// 頻率限制記憶體快取 (Sliding Window Rate Limiter)
const submissionRateMap = new Map<string, number[]>(); // key: IP, value: timestamps
const pinFailedAttemptsMap = new Map<string, { count: number; lockedUntil: number }>(); // key: IP
// 已授權的幹部 LINE Token 快取
const verifiedAdminTokens = new Map<string, { sub: string; name?: string; picture?: string; exp: number }>();

function isSubmissionRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 分鐘
  const maxSubmissions = 5; // 10 分鐘內最多 5 次

  const timestamps = (submissionRateMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxSubmissions) {
    return true;
  }
  timestamps.push(now);
  submissionRateMap.set(ip, timestamps);
  return false;
}

function checkPinBruteForce(ip: string): { locked: boolean; waitMinutes?: number } {
  const now = Date.now();
  const record = pinFailedAttemptsMap.get(ip);
  if (!record) return { locked: false };
  if (record.lockedUntil > now) {
    const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { locked: true, waitMinutes };
  }
  return { locked: false };
}

function recordPinFailure(ip: string) {
  const now = Date.now();
  const record = pinFailedAttemptsMap.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 鎖定 15 分鐘
    record.count = 0; // 重置計數
  }
  pinFailedAttemptsMap.set(ip, record);
}

function clearPinFailure(ip: string) {
  pinFailedAttemptsMap.delete(ip);
}

async function getAdminFromToken(c: any): Promise<{ sub: string; name?: string; picture?: string } | null> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (c.req.header('x-line-token') || c.req.query('token'));
  if (!token) return null;

  const now = Date.now();
  const cached = verifiedAdminTokens.get(token);
  if (cached && cached.exp > now) {
    return cached;
  }

  const profile = await verifyLineIdToken(token, c.env.LINE_LOGIN_CHANNEL_ID);
  if (!profile) return null;

  const allowedIds = [
    ...(c.env.ADMIN_LINE_IDS ? c.env.ADMIN_LINE_IDS.split(',').map((s: string) => s.trim()) : []),
    c.env.ADMIN_NOTIFY_USER_ID
  ].filter(Boolean);

  if (!allowedIds.includes(profile.sub)) {
    return null;
  }

  const adminData = {
    sub: profile.sub,
    name: profile.name,
    picture: profile.picture,
    exp: now + 30 * 60 * 1000
  };
  verifiedAdminTokens.set(token, adminData);
  return adminData;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', station: c.env.STATION_NAME || '高雄服務站', time: new Date().toISOString() });
});

// 1. 農友送出服務申請 (含 IP 頻率限制、Turnstile 無感真人驗證與 LINE ID Token 簽名驗證)
app.post('/api/requests', async (c) => {
  try {
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    if (isSubmissionRateLimited(clientIp)) {
      return c.json({
        success: false,
        message: '送單頻率過高，為保護系統資源請於 10 分鐘後再試，或直接電話聯繫服務站。'
      }, 429);
    }

    const body = await c.req.json<CreateServiceRequestDto>();

    // 1-1. Cloudflare Turnstile 無感真人驗證
    const turnstileSecret = c.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    if (body.turnstile_token) {
      const turnstileRes = await verifyTurnstileToken(body.turnstile_token, turnstileSecret, clientIp);
      if (!turnstileRes.success) {
        return c.json({ success: false, message: '真人安全驗證未通過，請重新整理頁面後再試。' }, 403);
      }
    }
    
    if (!body.contact_name || !body.phone || !body.service_type || !body.preferred_date) {
      return c.json({ success: false, message: '請完整填寫姓名、電話、服務項目與希望施工日期' }, 400);
    }

    const cleanPhone = (body.phone || '').replace(/[-\s]/g, '');
    const isMobile = /^09\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\d{7}$/.test(cleanPhone);

    if (!isMobile && !isLandline) {
      return c.json({ success: false, message: '電話格式錯誤：手機需為 09 開頭 10 碼，市話需為 02-08 開頭 9 碼數字' }, 400);
    }

    if ((body.crop_type || '').includes('其他') && !body.notes?.trim()) {
      return c.json({ success: false, message: '選擇其他作物種類時，請在補充備註填寫作物種類' }, 400);
    }

    // 1-2. LINE ID Token 簽名驗證（防偽身分）
    let verifiedLineUserId = body.line_user_id || null;
    if (body.id_token) {
      const lineProfile = await verifyLineIdToken(body.id_token, c.env.LINE_LOGIN_CHANNEL_ID);
      if (lineProfile) {
        verifiedLineUserId = lineProfile.sub;
      }
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
      verifiedLineUserId
    ).run();

    // 1. 推播給站所幹部（通知有新案件需求，附農民電話一鍵撥打按鈕）
    if (c.env.LINE_CHANNEL_ACCESS_TOKEN && c.env.ADMIN_NOTIFY_USER_ID) {
      const adminFlexMsg = generateFlexNotification({
        ...body,
        area_size: computedAreaSize,
        id
      });
      c.executionCtx.waitUntil(
        pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, c.env.ADMIN_NOTIFY_USER_ID, adminFlexMsg)
      );
    }

    // 2. 推播給申請農民（發送服務申請確認收據卡片）
    if (c.env.LINE_CHANNEL_ACCESS_TOKEN && verifiedLineUserId) {
      const customerFlexMsg = generateCustomerConfirmationFlex({
        ...body,
        area_size: computedAreaSize,
        id
      });
      c.executionCtx.waitUntil(
        pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, verifiedLineUserId, customerFlexMsg)
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

const DEFAULT_ADMIN_PIN = '20241718';

// 站所幹部 LINE 白名單身分驗證端點
app.post('/api/admin/auth/line', async (c) => {
  try {
    const body = await c.req.json<{ id_token: string }>().catch(() => ({ id_token: '' }));
    if (!body.id_token) {
      return c.json({ success: false, message: '缺少 LINE ID 憑證' }, 400);
    }

    const profile = await verifyLineIdToken(body.id_token, c.env.LINE_LOGIN_CHANNEL_ID);
    if (!profile) {
      return c.json({ success: false, message: 'LINE 身分憑證無效或已過期，請重新登入' }, 401);
    }

    const allowedIds = [
      ...(c.env.ADMIN_LINE_IDS ? c.env.ADMIN_LINE_IDS.split(',').map((s: string) => s.trim()) : []),
      c.env.ADMIN_NOTIFY_USER_ID
    ].filter(Boolean);

    if (!allowedIds.includes(profile.sub)) {
      return c.json({
        success: false,
        message: '存取受限：您的 LINE 帳號不在站所授權幹部白名單內。',
        userId: profile.sub,
        displayName: profile.name
      }, 403);
    }

    // 加入幹部 Session 快取
    verifiedAdminTokens.set(body.id_token, {
      sub: profile.sub,
      name: profile.name,
      picture: profile.picture,
      exp: Date.now() + 30 * 60 * 1000
    });

    return c.json({
      success: true,
      message: '站所幹部身分驗證成功',
      user: {
        userId: profile.sub,
        displayName: profile.name,
        pictureUrl: profile.picture
      }
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message || '身分驗證程序異常' }, 500);
  }
});

// 站所管理密碼驗證端點 (備援 PIN 模式，含防暴力破解暫時鎖定)
app.post('/api/admin/verify', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  
  // 防暴力破解檢核
  const lockStatus = checkPinBruteForce(clientIp);
  if (lockStatus.locked) {
    return c.json({
      success: false,
      message: `密碼連續錯誤次數過多，為維護安全已暫時鎖定，請於 ${lockStatus.waitMinutes} 分鐘後再試。`
    }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const pin = body.pin || c.req.header('x-admin-pin');
  const validPin = c.env.ADMIN_PIN || DEFAULT_ADMIN_PIN;

  if (pin !== validPin) {
    recordPinFailure(clientIp);
    return c.json({ success: false, message: '密碼錯誤，請輸入正確的站所管理密碼' }, 401);
  }

  clearPinFailure(clientIp);
  return c.json({ success: true, message: '驗證成功' });
});

// 站所管理員權限檢核 (優先檢驗 LINE 幹部白名單 Token，備援檢驗 PIN 碼)
app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/auth/line' || c.req.path === '/api/admin/verify') {
    return next();
  }

  // 1. 優先檢驗 LINE 幹部白名單 Token
  const admin = await getAdminFromToken(c);
  if (admin) {
    return next();
  }

  // 2. 備援檢驗 PIN 碼
  const pin = c.req.header('x-admin-pin') || c.req.query('pin');
  const validPin = c.env.ADMIN_PIN || DEFAULT_ADMIN_PIN;
  if (pin && pin === validPin) {
    return next();
  }

  return c.json({ success: false, message: '未經授權：請透過站所幹部 LINE 帳號登入或提供正確授權憑證' }, 401);
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

// 6. LINE Messaging API Webhook 端點 (處理農友在 LINE 聊天室內查詢預約進度或 Rich Menu 點擊)
app.get('/api/line/webhook', (c) => {
  return c.text('LINE Webhook is active', 200);
});

app.post('/api/line/webhook', async (c) => {
  try {
    const rawBody = await c.req.text();
    console.log('LINE Webhook received raw body:', rawBody);
    
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn('Failed to parse Webhook JSON');
    }
    
    const events: any[] = body.events || [];

    if (!events.length) {
      console.log('LINE Webhook: Empty events (Verify request)');
      return c.text('OK', 200);
    }

    const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
      return c.text('OK', 200);
    }

    for (const event of events) {
      console.log('Processing LINE event:', JSON.stringify(event));
      const replyToken = event.replyToken;
      const userId = event.source?.userId;
      if (!replyToken) {
        console.warn('Skipping event without replyToken');
        continue;
      }

      let isQuery = false;
      let isBooking = false;

      if (event.type === 'message' && event.message?.type === 'text') {
        const text = (event.message.text || '').trim();
        console.log('Received user text:', text, 'from userId:', userId);

        if (
          text.includes('查') ||
          text.includes('進度') ||
          text.includes('單號') ||
          text.includes('紀錄') ||
          text.includes('狀態') ||
          /^(query|status|list)$/i.test(text)
        ) {
          isQuery = true;
        } else if (
          text.includes('預約') ||
          text.includes('申請') ||
          text.includes('粉碎') ||
          text.includes('代耕') ||
          /^(book|apply)$/i.test(text)
        ) {
          isBooking = true;
        }
      } else if (event.type === 'postback') {
        const data = event.postback?.data || '';
        console.log('Received postback data:', data);
        if (data.includes('query')) {
          isQuery = true;
        } else if (data.includes('book')) {
          isBooking = true;
        }
      }

      if (isQuery) {
        // 從資料庫查詢該 LINE 用戶最新的預約紀錄
        let records: any = { results: [] };
        if (userId) {
          records = await c.env.DB.prepare(
            'SELECT * FROM service_requests WHERE line_user_id = ? ORDER BY created_at DESC LIMIT 5'
          ).bind(userId).all();
        }

        console.log('Found records count for query:', records.results?.length || 0);
        const flexMsg = generateProgressQueryFlex(records.results || []);
        await replyLineMessage(token, replyToken, [flexMsg]);
      } else if (isBooking) {
        const bookingCard = {
          type: 'flex',
          altText: '【線上預約】行農合作社服務預約',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#173820',
              paddingAll: '18px',
              contents: [
                { type: 'text', text: '🌱 行農合作社 · 高雄服務站', color: '#bbf7d0', size: 'xs', weight: 'bold' },
                { type: 'text', text: '📝 線上服務預約申請', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '18px',
              spacing: 'sm',
              contents: [
                { type: 'text', text: '歡迎使用農機枝條粉碎與代耕服務線上預約！', size: 'sm', color: '#20271f', weight: 'bold' },
                { type: 'text', text: '點擊下方按鈕即可開啟預約表單，填寫作物、面積與希望施工日期，服務站將儘速與您聯繫排程。', size: 'xs', color: '#657061', wrap: true }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'uri',
                    label: '🌱 開啟預約申請表',
                    uri: 'https://liff.line.me/2011709076-09FdfkjH'
                  },
                  style: 'primary',
                  color: '#173820'
                }
              ]
            }
          }
        };

        await replyLineMessage(token, replyToken, [bookingCard]);
      } else {
        // 其他任何訊息（包含打招呼、測試等），主動回覆功能導覽卡片
        const welcomeFlex = generateWelcomeGuideFlex();
        await replyLineMessage(token, replyToken, [welcomeFlex]);
      }
    }

    return c.text('OK', 200);
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return c.text('OK', 200);
  }
});

// 7. 診斷端點：手動推播測試卡片至特定 LINE User ID
app.get('/api/debug/test-card', async (c) => {
  const userId = c.req.query('userId') || 'Ub799ecd073a5b090bf7a7ceee8eeef83';
  const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return c.json({ error: 'Missing LINE_CHANNEL_ACCESS_TOKEN' }, 500);

  const records = await c.env.DB.prepare(
    'SELECT * FROM service_requests WHERE line_user_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(userId).all();

  const flexMsg = generateProgressQueryFlex(records.results || []);
  await pushLineMessage(token, userId, flexMsg);

  return c.json({
    success: true,
    message: 'Test card pushed to ' + userId,
    recordsCount: records.results?.length || 0,
    latestRecord: records.results?.[0] || null
  });
});

export default app;
