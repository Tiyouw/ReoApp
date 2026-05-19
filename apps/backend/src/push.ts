import webPush from 'web-push';
import { supabase } from './supabase';

// Configure VAPID keys from environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:reo@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

/** Save a push subscription for a device */
export async function saveSubscription(deviceToken: string, subscription: webPush.PushSubscription) {
  const { error } = await supabase.from('push_subscriptions').upsert({
    device_token: deviceToken,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  return !error;
}

/** Remove a push subscription */
export async function removeSubscription(endpoint: string) {
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/** Send a push notification to all subscriptions for a device */
export async function sendPushToDevice(
  deviceToken: string,
  payload: { title: string; body: string; icon?: string; url?: string }
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not configured, skipping push');
    return;
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('device_token', deviceToken);

  if (!subs?.length) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/mascot.png',
    url: payload.url || '/',
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys } as webPush.PushSubscription,
        pushPayload
      ).catch(async (err) => {
        // If subscription expired (410 Gone), remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removeSubscription(sub.endpoint);
        }
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[Push] Sent ${sent}/${subs.length} notifications to ${deviceToken}`);
}

/** Get public VAPID key for client subscription */
export function getVapidPublicKey() {
  return vapidPublicKey;
}
