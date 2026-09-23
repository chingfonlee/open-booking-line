export function generateFlexNotification(request: any) {
  const slotMap: Record<string, string> = {
    morning: '上午',
    afternoon: '下午',
    any: '皆可'
  };
  const slotText = slotMap[request.preferred_time_slot] || request.preferred_time_slot;

  return {
    type: 'flex',
    altText: '【新服務申請】' + request.contact_name + ' - ' + request.service_type,
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
              label: '撥打電話：' + request.phone,
              uri: 'tel:' + request.phone
            },
            style: 'primary',
            color: '#15803d'
          }
        ]
      }
    }
  };
}

export async function pushLineMessage(token: string, targetId: string, flexMessage: any) {
  if (!token || !targetId) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        to: targetId,
        messages: [flexMessage]
      })
    });
  } catch (err) {
    console.error('Failed to push LINE message:', err);
  }
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
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
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
