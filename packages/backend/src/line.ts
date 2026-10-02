export function generateFlexNotification(request: any, liffId?: string, stationName?: string) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[request.preferred_time_slot] || request.preferred_time_slot;

  return {
    type: 'flex',
    altText: '【新服務申請】單號：' + (request.id || '最新') + ' (' + request.contact_name + ' - ' + request.service_type + ')',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#15803d',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🌱 ' + station,
            color: '#bbf7d0',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: '收到新的服務申請需求',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
            margin: 'xs'
          },
          {
            type: 'text',
            text: '單號：' + request.id,
            color: '#dcebd6',
            size: 'xs',
            margin: 'sm',
            weight: 'bold'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '預約單號', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.id, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '申請人', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.contact_name + ' (' + request.phone + ')', size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.crop_type + ' · ' + request.area_size + (request.branch_volume ? ' (' + request.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '希望日期', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.preferred_date + ' (' + slotText + ')' + (request.date_flexibility ? ' · ' + request.date_flexibility : ''), size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '地點', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.location_area + ' ' + request.location_address, size: 'sm', color: '#0f172a', flex: 5, wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📞 撥打電話：' + request.phone,
              uri: 'tel:' + request.phone
            },
            style: 'primary',
            color: '#15803d'
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🛠️ 開啟服務站管理後台',
              uri: 'https://liff.line.me/' + activeLiffId + '?view=admin'
            },
            style: 'secondary'
          }
        ]
      }
    }
  };
}

export function generateCustomerConfirmationFlex(request: any, liffId?: string, stationName?: string) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[request.preferred_time_slot] || request.preferred_time_slot;

  return {
    type: 'flex',
    altText: '【預約已送出】單號：' + request.id + '，服務站將儘速與您聯繫！',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173820',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '🌱 ' + station,
            color: '#bbf7d0',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: '✅ 預約申請已收到',
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
            margin: 'xs'
          },
          {
            type: 'text',
            text: '單號：' + request.id,
            color: '#dcebd6',
            size: 'xs',
            margin: 'sm',
            weight: 'bold'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '預約單號', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.id, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.crop_type + ' · ' + request.area_size + (request.branch_volume ? ' (' + request.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '希望日期', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.preferred_date + ' (' + slotText + ')' + (request.date_flexibility ? ' · ' + request.date_flexibility : ''), size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '施作地點', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.location_area + ' ' + request.location_address, size: 'sm', color: '#0f172a', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#f8f3e7',
            cornerRadius: '10px',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: '📞 服務人員已收到您的預約，將儘速撥打電話確認確切施工排程細節。',
                size: 'xs',
                color: '#657061',
                wrap: true
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '開啟預約服務入口',
              uri: 'https://liff.line.me/' + activeLiffId
            },
            style: 'primary',
            color: '#173820'
          }
        ]
      }
    }
  };
}

function sanitizeToken(token?: string): string {
  if (!token) return '';
  return token.replace(/[^\x21-\x7E]/g, '').trim();
}

export async function pushLineMessage(token: string, targetId: string, flexMessage: any, db?: any) {
  const cleanToken = sanitizeToken(token);
  if (!cleanToken || !targetId) {
    if (db) {
      try {
        const logId = crypto.randomUUID();
        await db.prepare('INSERT INTO system_push_logs (id, target_id, status, response_text, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(logId, targetId || 'EMPTY', 0, 'Missing cleanToken or targetId', new Date().toISOString()).run();
      } catch {}
    }
    return;
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cleanToken
      },
      body: JSON.stringify({
        to: targetId,
        messages: [flexMessage]
      })
    });
    const errText = await res.text();
    const maskedTarget = targetId && targetId.length > 8 ? targetId.slice(0, 4) + '***' + targetId.slice(-4) : '***';
    if (!res.ok) {
      console.error('Failed to push LINE message to ' + maskedTarget + ':', res.status, errText);
    } else {
      console.log('Successfully pushed LINE message to ' + maskedTarget + ':', res.status);
    }
    if (db) {
      try {
        const logId = crypto.randomUUID();
        await db.prepare('INSERT INTO system_push_logs (id, target_id, status, response_text, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(logId, targetId, res.status, errText, new Date().toISOString()).run();
      } catch (dbErr) {
        console.error('Failed to write system_push_logs:', dbErr);
      }
    }
  } catch (err: any) {
    const maskedTarget = targetId && targetId.length > 8 ? targetId.slice(0, 4) + '***' + targetId.slice(-4) : '***';
    console.error('Failed to push LINE message to ' + maskedTarget + ':', err);
    if (db) {
      try {
        const logId = crypto.randomUUID();
        await db.prepare('INSERT INTO system_push_logs (id, target_id, status, response_text, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(logId, targetId, 500, String(err?.message || err), new Date().toISOString()).run();
      } catch {}
    }
  }
}

export async function replyLineMessage(token: string, replyToken: string, messages: any[]): Promise<boolean> {
  const cleanToken = sanitizeToken(token);
  if (!cleanToken || !replyToken || !messages.length) {
    console.warn('replyLineMessage skipped: missing parameters', { hasToken: !!cleanToken, hasReplyToken: !!replyToken, msgCount: messages?.length });
    return false;
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cleanToken
      },
      body: JSON.stringify({
        replyToken,
        messages
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to reply LINE message:', res.status, err);
      return false;
    }
    const maskedReplyToken = replyToken && replyToken.length > 8 ? replyToken.slice(0, 6) + '...' : '***';
    console.log('Successfully replied LINE message to token:', maskedReplyToken);
    return true;
  } catch (err) {
    console.error('Failed to reply LINE message exception:', err);
    return false;
  }
}

export function generateWelcomeGuideFlex(liffId?: string, stationName?: string) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';
  return {
    type: 'flex',
    altText: '【服務選單】' + station + '服務選單',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173820',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '🌱 ' + station, color: '#bbf7d0', size: 'xs', weight: 'bold' },
          { type: 'text', text: '服務專屬選單', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '您好！歡迎使用行農合作社智慧服務系統。', size: 'sm', color: '#20271f', weight: 'bold' },
          { type: 'text', text: '請點選下方功能，即可進行線上預約或查詢您目前的申請進度：', size: 'xs', color: '#657061', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '🌱 線上預約申請',
              uri: 'https://liff.line.me/' + activeLiffId
            },
            style: 'primary',
            color: '#173820'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📋 查詢我的預約進度',
              text: '查詢預約'
            },
            style: 'secondary'
          }
        ]
      }
    }
  };
}

function createProgressQueryBubble(
  item: any,
  index: number,
  total: number,
  activeLiffId: string,
  station: string
) {
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[item.preferred_time_slot] || item.preferred_time_slot;

  let statusBadgeColor = '#856200';
  let statusBadgeBg = '#fef3c7';
  let statusText = '🟡 待聯絡 (服務站已受理，專人排程中)';
  let statusNote = '服務人員已收到您的申請，將儘速致電確認確切施工排程。';

  const dateRowTitle = (item.status === 'confirmed' || item.status === 'processing') && item.scheduled_date ? '確認日期' : '希望日期';
  const displayedDate = item.scheduled_date || item.preferred_date;
  const displayedSlotText = item.scheduled_slot_code ? (slotMap[item.scheduled_slot_code] || item.scheduled_slot_code) : slotText;

  if (item.status === 'confirmed') {
    statusBadgeColor = '#15803d';
    statusBadgeBg = '#dcfce7';
    statusText = '🟢 已確認排程 (服務日期已排定)';
    statusNote = item.scheduled_start_time
      ? `已確認於 ${displayedDate} (${displayedSlotText}) ${item.scheduled_start_time} 開工，請保持電話暢通。`
      : `已確認於 ${displayedDate} (${displayedSlotText}) 提供服務，請保持電話暢通。`;
  } else if (item.status === 'processing') {
    statusBadgeColor = '#1e40af';
    statusBadgeBg = '#dbeafe';
    statusText = '🔵 施工處理中 (機具與工班調度施作中)';
    statusNote = '站所已與您聯繫確認，目前正調配機具與人員準備施作。';
  } else if (item.status === 'closed') {
    statusBadgeColor = '#334155';
    statusBadgeBg = '#f1f5f9';
    statusText = '⚪ 已結案 (服務已完成)';
    statusNote = '本筆預約已順利施工完成，感謝您的支持！';
  } else if (item.status === 'cancelled') {
    statusBadgeColor = '#b91c1c';
    statusBadgeBg = '#fee2e2';
    statusText = '🔴 已取消 (預約已終止)';
    statusNote = '本筆預約已取消。若有其他需求，歡迎重新線上預約。';
  }

  const bodyContents: any[] = [
    {
      type: 'box',
      layout: 'vertical',
      backgroundColor: statusBadgeBg,
      cornerRadius: '8px',
      paddingAll: '10px',
      contents: [
        { type: 'text', text: statusText, size: 'xs', weight: 'bold', color: statusBadgeColor, wrap: true }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: '預約單號', size: 'xs', color: '#64748b', flex: 2 },
        { type: 'text', text: item.id, size: 'xs', color: '#0f172a', weight: 'bold', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: item.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: item.crop_type + ' · ' + item.area_size + (item.branch_volume ? ' (' + item.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: dateRowTitle, size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: displayedDate + ' (' + displayedSlotText + ')', size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
      ]
    }
  ];

  if (item.scheduled_start_time) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '開工時間', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: item.scheduled_start_time + ' 準時抵達', size: 'sm', color: '#15803d', weight: 'bold', flex: 5 }
      ]
    });
  }

  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: '施作地點', size: 'sm', color: '#64748b', flex: 2 },
      { type: 'text', text: item.location_area + ' ' + (item.location_address || ''), size: 'sm', color: '#0f172a', flex: 5, wrap: true }
    ]
  });

  // 安全隱私防護：admin_memo 為站所內部紀錄 (僅站所可見)，絕不可對外洩漏給客戶。
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    backgroundColor: '#faf8f3',
    cornerRadius: '8px',
    paddingAll: '10px',
    contents: [
      { type: 'text', text: '💬 ' + statusNote, size: 'xs', color: '#657061', wrap: true }
    ]
  });

  // 服務站重要叮嚀 (若站所排程時有特別註明 customer_notice 提醒農友)
  const noticeText = item.customer_notice || item.notes;
  if (noticeText && (item.status === 'confirmed' || item.status === 'processing')) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      backgroundColor: '#fefce8',
      borderColor: '#fde047',
      borderWidth: '1px',
      cornerRadius: '8px',
      paddingAll: '10px',
      contents: [
        {
          type: 'text',
          text: '📢 服務站重要叮嚀：',
          size: 'xs',
          weight: 'bold',
          color: '#854d0e'
        },
        {
          type: 'text',
          text: noticeText,
          size: 'xs',
          color: '#713f12',
          wrap: true,
          margin: 'xs'
        }
      ]
    });
  }

  const headerSubtitle = total > 1
    ? `📋 預約進度 (第 ${index + 1} / ${total} 筆)`
    : '📋 您的服務預約進度';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#173820',
      paddingAll: '18px',
      contents: [
        { type: 'text', text: '🌱 ' + station, color: '#bbf7d0', size: 'xs', weight: 'bold' },
        { type: 'text', text: headerSubtitle, color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: bodyContents
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '🌱 填寫新預約申請',
            uri: 'https://liff.line.me/' + activeLiffId
          },
          style: 'primary',
          color: '#173820'
        }
      ]
    }
  };
}

export function generateProgressQueryFlex(requests: any[], liffId?: string, stationName?: string) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';

  // 1. 查無任何預約紀錄
  if (!requests || requests.length === 0) {
    return {
      type: 'flex',
      altText: '【預約查詢】目前查無您的預約紀錄',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#173820',
          paddingAll: '18px',
          contents: [
            { type: 'text', text: '🌱 ' + station, color: '#bbf7d0', size: 'xs', weight: 'bold' },
            { type: 'text', text: '📋 預約申請查詢', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '18px',
          spacing: 'md',
          contents: [
            { type: 'text', text: '目前查無您的預約紀錄', size: 'md', weight: 'bold', color: '#20271f' },
            { type: 'text', text: '若您有果樹枝條粉碎、代耕或農機租借需求，歡迎隨時點擊下方按鈕線上預約！', size: 'sm', color: '#657061', wrap: true }
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
                label: '🌱 立即線上預約',
                uri: 'https://liff.line.me/' + activeLiffId
              },
              style: 'primary',
              color: '#173820'
            }
          ]
        }
      }
    };
  }

  // LINE 官方限制單一 Carousel 上限 12 筆，系統取前 10 筆
  const items = requests.slice(0, 10);

  // 2. 單筆紀錄時，維持單一 Bubble（俐落直接）
  if (items.length === 1) {
    const bubble = createProgressQueryBubble(items[0], 0, 1, activeLiffId, station);
    return {
      type: 'flex',
      altText: `【預約進度】${items[0].service_type} - 單號：${items[0].id}`,
      contents: bubble
    };
  }

  // 3. 多筆紀錄時，組合為橫向輪播 Carousel
  const bubbles = items.map((item, idx) =>
    createProgressQueryBubble(item, idx, items.length, activeLiffId, station)
  );

  return {
    type: 'flex',
    altText: `【預約進度】您有 ${items.length} 筆預約申請紀錄，請向左滑動查看`,
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

export interface VerifiedLineProfile {
  sub: string; // LINE User ID
  name?: string;
  picture?: string;
  email?: string;
  exp?: number; // Token 過期時間戳 (UNIX 秒數)
}

export async function verifyLineIdToken(idToken: string, channelId?: string): Promise<VerifiedLineProfile | null> {
  if (!idToken) return null;
  try {
    const params = new URLSearchParams();
    params.append('id_token', idToken);
    if (channelId) {
      params.append('client_id', channelId);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      const errText = await res.text();
      console.warn('LINE ID token verification failed:', res.status, errText);
      return null;
    }
    const data = await res.json() as any;
    return {
      sub: data.sub,
      name: data.name,
      picture: data.picture,
      email: data.email,
      exp: typeof data.exp === 'number' ? data.exp : undefined
    };
  } catch (err) {
    console.error('Failed to verify LINE ID token:', err);
    return null;
  }
}

/**
 * 驗證 LINE Webhook x-line-signature 簽名 (HMAC-SHA256)
 * 防止偽造 Webhook 事件刷後端 D1 或消耗 LINE 配額
 */
export async function verifyLineSignature(
  rawBody: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  if (!rawBody || !signature || !channelSecret) return false;
  try {
    const cleanSecret = channelSecret.trim();
    const cleanSignature = signature.trim();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(cleanSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    return constantTimeEqual(computedSignature, cleanSignature);
  } catch (err) {
    console.error('Failed to verify LINE signature:', err);
    return false;
  }
}

/**
 * 恆定時間字串比對 (防止時序攻擊 Timing Attack)
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function generateAdminPortalFlex(liffId?: string, stationName?: string) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';
  return {
    type: 'flex',
    altText: '【服務站管理】專屬管理後台通道',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173820',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '🌱 ' + station, color: '#bbf7d0', size: 'xs', weight: 'bold' },
          { type: 'text', text: '🛠️ 服務站管理系統', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '服務人員身分驗證通過', size: 'sm', color: '#15803d', weight: 'bold' },
          { type: 'text', text: '點擊下方按鈕即可直接於 LINE 內開啟全螢幕管理儀表板，進行案件查詢、狀態更新與額滿排程管理：', size: 'xs', color: '#657061', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📋 開啟服務站管理後台',
              uri: 'https://liff.line.me/' + activeLiffId + '?view=admin'
            },
            style: 'primary',
            color: '#173820'
          }
        ]
      }
    }
  };
}

/**
 * Ep03: 產生正式預約確認推播卡片 (包含正式服務日期與精確開工時間)
 */
export function generateScheduledConfirmationFlex(
  request: any,
  reservation: { booking_date: string; slot_code: string; scheduled_start_time: string; notes?: string },
  liffId?: string,
  stationName?: string,
  isReschedule: boolean = false
) {
  const activeLiffId = liffId || '';
  const station = stationName || '預約服務站';
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午'
  };
  const slotText = slotMap[reservation.slot_code] || reservation.slot_code;

  const headerTitle = isReschedule ? '📅 預約排程已更新 (改期)' : '🎉 預約排程已正式確認';
  const altPrefix = isReschedule ? '【服務排程已改期】' : '【服務排程已確認】';

  return {
    type: 'flex',
    altText: altPrefix + '單號：' + request.id + '，排定日期：' + reservation.booking_date + ' ' + reservation.scheduled_start_time,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#15803d',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '🌱 ' + station,
            color: '#bbf7d0',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: headerTitle,
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
            margin: 'xs'
          },
          {
            type: 'text',
            text: '單號：' + request.id,
            color: '#dcebd6',
            size: 'xs',
            margin: 'sm',
            weight: 'bold'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '預約單號', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.id, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.crop_type + ' · ' + request.area_size + (request.branch_volume ? ' (' + request.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '確認日期', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: reservation.booking_date + ' (' + slotText + ')', size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '開工時間', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: reservation.scheduled_start_time + ' 準時抵達', size: 'sm', color: '#15803d', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '施作地點', size: 'sm', color: '#64748b', flex: 2 },
              { type: 'text', text: request.location_area + ' ' + (request.location_address || ''), size: 'sm', color: '#0f172a', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: reservation.notes ? '#fefce8' : '#f8f3e7',
            borderColor: reservation.notes ? '#fde047' : '#f0eae0',
            borderWidth: reservation.notes ? '1px' : '0px',
            cornerRadius: '10px',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: reservation.notes ? '📢 服務站重要叮嚀：' : '🌾 服務站貼心叮嚀：',
                size: 'xs',
                weight: 'bold',
                color: reservation.notes ? '#854d0e' : '#2a5937'
              },
              {
                type: 'text',
                text: reservation.notes || '服務站已安排工班與機具，請您於約定時間保持電話暢通。感謝您的配合！',
                size: 'xs',
                color: reservation.notes ? '#713f12' : '#657061',
                wrap: true,
                margin: 'xs'
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📋 查詢預約進度',
              uri: 'https://liff.line.me/' + activeLiffId
            },
            style: 'primary',
            color: '#15803d'
          }
        ]
      }
    }
  };
}

