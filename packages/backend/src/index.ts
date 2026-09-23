import { Hono } from 'hono';
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

    const cleanPhone = (body.phone || '').replace(/[-\s]/g, '');
    const isMobile = /^09\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\d{7}$/.test(cleanPhone);

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
