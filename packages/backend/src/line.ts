export function generateFlexNotification(request: any) {
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
            text: '🌱 行農合作社 · 高雄服務站',
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
              uri: 'https://liff.line.me/2000000000-XXXXXXXX?view=admin'
            },
            style: 'secondary'
          }
        ]
      }
    }
  };
}

export function generateCustomerConfirmationFlex(request: any) {
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
            text: '🌱 行農合作社 · 高雄服務站',
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
              uri: 'https://liff.line.me/2000000000-XXXXXXXX'
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

export async function pushLineMessage(token: string, targetId: string, flexMessage: any) {
  const cleanToken = sanitizeToken(token);
  if (!cleanToken || !targetId) return;
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
    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to push LINE message to ' + targetId + ':', res.status, err);
    }
  } catch (err) {
    console.error('Failed to push LINE message to ' + targetId + ':', err);
  }
}

export async function replyLineMessage(token: string, replyToken: string, messages: any[]): Promise<boolean> {
  const cleanToken = sanitizeToken(token);
  if (!cleanToken || !replyToken || !messages.length) {
    console.warn('replyLineMessage skipped: missing parameters', { hasToken: !!cleanToken, replyToken, msgCount: messages?.length });
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
    console.log('Successfully replied LINE message to token:', replyToken);
    return true;
  } catch (err) {
    console.error('Failed to reply LINE message exception:', err);
    return false;
  }
}

export function generateWelcomeGuideFlex() {
  return {
    type: 'flex',
    altText: '【服務選單】行農合作社服務選單',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173820',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '🌱 行農合作社 · 高雄服務站', color: '#bbf7d0', size: 'xs', weight: 'bold' },
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
              uri: 'https://liff.line.me/2000000000-XXXXXXXX'
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

export function generateProgressQueryFlex(requests: any[]) {
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
            { type: 'text', text: '🌱 行農合作社 · 高雄服務站', color: '#bbf7d0', size: 'xs', weight: 'bold' },
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
                uri: 'https://liff.line.me/2000000000-XXXXXXXX'
              },
              style: 'primary',
              color: '#173820'
            }
          ]
        }
      }
    };
  }

  const latest = requests[0];
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[latest.preferred_time_slot] || latest.preferred_time_slot;

  let statusBadgeColor = '#856200';
  let statusBadgeBg = '#fef3c7';
  let statusText = '🟡 待聯絡 (服務站已受理，專人排程中)';
  let statusNote = '服務人員已收到您的申請，將儘速致電確認確切施工排程。';

  if (latest.status === 'processing') {
    statusBadgeColor = '#1e40af';
    statusBadgeBg = '#dbeafe';
    statusText = '🔵 處理中 (已聯繫確認，安排施工中)';
    statusNote = '站所已與您聯繫確認，目前正調配機具與人員準備施作。';
  } else if (latest.status === 'closed') {
    statusBadgeColor = '#334155';
    statusBadgeBg = '#f1f5f9';
    statusText = '⚪ 已結案 (服務已完成)';
    statusNote = '本筆預約已順利施工完成，感謝您的支持！';
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
        { type: 'text', text: latest.id, size: 'xs', color: '#0f172a', weight: 'bold', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '服務項目', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: latest.service_type, size: 'sm', color: '#0f172a', weight: 'bold', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '作物 / 面積', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: latest.crop_type + ' · ' + latest.area_size + (latest.branch_volume ? ' (' + latest.branch_volume + ')' : ''), size: 'sm', color: '#0f172a', flex: 5 }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '希望日期', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: latest.preferred_date + ' (' + slotText + ')', size: 'sm', color: '#15803d', weight: 'bold', flex: 5, wrap: true }
      ]
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '施作地點', size: 'sm', color: '#64748b', flex: 2 },
        { type: 'text', text: latest.location_area + ' ' + (latest.location_address || ''), size: 'sm', color: '#0f172a', flex: 5, wrap: true }
      ]
    }
  ];

  if (latest.admin_memo) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      backgroundColor: '#f8f3e7',
      cornerRadius: '8px',
      paddingAll: '10px',
      contents: [
        { type: 'text', text: '站所內部回覆：' + latest.admin_memo, size: 'xs', color: '#2a5937', wrap: true }
      ]
    });
  } else {
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
  }

  return {
    type: 'flex',
    altText: '【預約進度】' + latest.service_type + ' - ' + statusText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#173820',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '🌱 行農合作社 · 高雄服務站', color: '#bbf7d0', size: 'xs', weight: 'bold' },
          { type: 'text', text: '📋 您的服務預約進度', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
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
              uri: 'https://liff.line.me/2000000000-XXXXXXXX'
            },
            style: 'primary',
            color: '#173820'
          }
        ]
      }
    }
  };
}

export interface VerifiedLineProfile {
  sub: string; // LINE User ID
  name?: string;
  picture?: string;
  email?: string;
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
      email: data.email
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
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
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
    return constantTimeEqual(computedSignature, signature);
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

export function generateAdminPortalFlex() {
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
          { type: 'text', text: '🌱 行農合作社 · 高雄服務站', color: '#bbf7d0', size: 'xs', weight: 'bold' },
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
              uri: 'https://liff.line.me/2000000000-XXXXXXXX?view=admin'
            },
            style: 'primary',
            color: '#173820'
          }
        ]
      }
    }
  };
}
