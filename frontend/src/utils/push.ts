import { api } from '../api/client';

// Web-Push braucht den VAPID-Public-Key als Uint8Array (applicationServerKey), das Backend liefert
// ihn aber als base64url-String (siehe routes/push.ts) – Standard-Konvertierung laut MDN/web.dev.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Fragt Benachrichtigungs-Berechtigung an, abonniert Push beim Browser und meldet das Abonnement
 *  ans Backend (routes/push.ts) – wirft, falls die Berechtigung verweigert wird oder Push serverseitig
 *  nicht konfiguriert ist (kein VAPID-Schlüssel, siehe push.ts), der Aufrufer zeigt das als Fehler an. */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported())
    throw new Error('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('Berechtigung für Benachrichtigungen wurde nicht erteilt');

  const { publicKey } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.delete(`/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`).catch(() => {
    // Abo ist clientseitig ohnehin schon weg – ein Fehler beim Backend-Aufräumen (z. B. offline)
    // soll die UI trotzdem als "abgemeldet" zeigen.
  });
}
