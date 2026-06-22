/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Web Push helpers: subscribe/unsubscribe the device and register the daily
 * reminder hour. iOS requires the PWA to be installed to the home screen and
 * notification permission to be granted from a user gesture.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export async function getPushState(): Promise<PushState> {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (!supported) return { supported: false, permission: "unsupported", subscribed: false };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return { supported: true, permission: Notification.permission, subscribed: !!sub };
}

/**
 * Subscribe this device to push and register the reminder.
 * localHour = the hour (0-23) in the user's LOCAL time they want the reminder.
 * We convert to a UTC hour for the server-side cron.
 */
export async function subscribeToPush(userId: string, localHour: number): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, error: "Tu navegador no soporta notificaciones push." };
    }
    // Permission must be requested from a user gesture (the calling button)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "No diste permiso de notificaciones." };
    }

    const keyRes = await fetch("/api/push/vapid-public-key");
    const { key, enabled } = await keyRes.json();
    if (!enabled || !key) return { ok: false, error: "El servidor no tiene push configurado todavía." };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    // Convert local reminder hour → UTC hour for the cron.
    const offsetHours = new Date().getTimezoneOffset() / 60; // e.g. Mexico = +6
    const reminderHourUtc = ((localHour + offsetHours) % 24 + 24) % 24;

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub, reminderHourUtc: Math.round(reminderHourUtc) }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error || "Error al guardar la suscripción." };
    }

    // Fire a confirmation test push
    fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub }),
    }).catch(() => {});

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al activar notificaciones." };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* best-effort */
  }
}
