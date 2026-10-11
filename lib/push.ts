import webpush from 'web-push';
import { supabase } from './supabase';

let ready: boolean | null = null;
function setup() {
  if (ready !== null) return ready;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subj } = process.env;
  ready = !!(pub && priv && subj);
  if (ready) webpush.setVapidDetails(subj!, pub!, priv!);
  return ready;
}
export const pushEnabled = () => setup();

export type PushPayload = { title: string; body: string; tag?: string; url?: string };

// Envia a notificação para todos os aparelhos registrados do usuário; remove os que não existem mais
export async function sendToUser(userId: string, payload: PushPayload) {
  if (!setup()) return 0;
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  if (!subs?.length) return 0;
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
  return sent;
}
