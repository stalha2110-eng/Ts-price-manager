import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, auth, sanitizeForFirestore, handleFirestoreError, OperationType, getMessagingInstance } from '../firebase';
import { InAppNotification, DeviceRegistration } from '../types';

import { 
  playSynthesizedSound, 
  triggerHapticFeedback 
} from './soundFeedbackService';

function getSavedSettings() {
  try {
    const data = localStorage.getItem('price_manager_settings');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return {};
}

// Web Audio API custom high-tech synth chime (using centralized SoundFeedbackService)
export function playNotificationChime(priority: 'high' | 'medium' | 'low' = 'medium') {
  try {
    const settings = getSavedSettings();
    playSynthesizedSound('notification', { settings });
  } catch (err) {
    console.warn('Notification chime failed', err);
  }
}

// Custom Haptic Vibration (using centralized SoundFeedbackService)
export function triggerVibration(priority: 'high' | 'medium' | 'low' = 'medium') {
  try {
    const settings = getSavedSettings();
    triggerHapticFeedback(settings, 'notification');
  } catch (err) {
    console.warn('Vibration failed', err);
  }
}

// Unique local client device id generation/tracking
export function getOrCreateDeviceId(): string {
  let devId = localStorage.getItem('ts_pm_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('ts_pm_device_id', devId);
  }
  return devId;
}

// Dynamic PWA Notification Permission
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.error('Notification permission request failed', e);
      return false;
    }
  }
  return false;
}

export class NotificationService {
  private static listenerUnsubscribe: (() => void) | null = null;
  private static onMessageUnsubscribe: (() => void) | null = null;
  private static listenerStartedAt: number = Date.now();
  private static isSubscribedToTokens: boolean = false;

  /**
   * Initialize standard listeners for real-time notification sync from Firestore.
   */
  public static initNotificationSync(
    userId: string | null,
    onNotificationsUpdate: (notifications: InAppNotification[]) => void,
    settingsGetter: () => any
  ) {
    // Unsubscribe from existing
    if (this.listenerUnsubscribe) {
      this.listenerUnsubscribe();
      this.listenerUnsubscribe = null;
    }
    if (this.onMessageUnsubscribe) {
      this.onMessageUnsubscribe();
      this.onMessageUnsubscribe = null;
    }

    if (!userId || userId === 'guest_user') return;
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.warn('initNotificationSync deferred: Auth state not fully ready/matched.');
      return;
    }

    this.listenerStartedAt = Date.now();
    const notifsRef = collection(db, 'users', userId, 'notifications');
    const qOnNotifications = query(notifsRef, orderBy('timestamp', 'desc'), limit(100));

    // Register standard foreground FCM messaging handler
    getMessagingInstance().then((messaging) => {
      if (messaging) {
        this.onMessageUnsubscribe = onMessage(messaging, (payload) => {
          console.log('[NotificationService] Foreground message received:', payload);
          const title = payload.notification?.title || payload.data?.title || 'TS Price Manager';
          const body = payload.notification?.body || payload.data?.body || '';
          const category = payload.data?.category || 'system';
          const priority = payload.data?.priority || 'medium';
          const screen = payload.data?.screen || 'home';

          const settings = settingsGetter();
          if (settings.soundOn !== false) {
            playNotificationChime(priority as any);
          }
          if (settings.vibrationOn !== false) {
            triggerVibration(priority as any);
          }

          if (settings.pushOn !== false && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: body,
                icon: '/logoTSPM.png',
                tag: `ts-pm-foreground-${Date.now()}`,
                data: { screen }
              });
            } catch (err) {
              console.warn('Foreground system notification failed:', err);
            }
          }
        });
      }
    }).catch(err => console.warn('Foreground messaging initialization deferred:', err));

    // Register this device token
    this.registerCurrentDevice(userId).catch(console.error);

    // Sync notification collection
    this.listenerUnsubscribe = onSnapshot(
      qOnNotifications,
      (snapshot) => {
        const list: InAppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            title: d.title || '',
            message: d.message || '',
            timestamp: d.timestamp || new Date().toISOString(),
            category: d.category || 'system',
            priority: d.priority || 'medium',
            isRead: d.isRead ?? false,
            deepLink: d.deepLink,
          } as InAppNotification);
        });

        // Trigger reactions only for NEW real-time notifications received AFTER app boot listener set up
        let hasNewHighPriority = false;
        let hasNewNotificationObj: InAppNotification | null = null;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const addedData = change.doc.data();
            const changeTime = addedData.timestamp ? new Date(addedData.timestamp).getTime() : Date.now();
            
            // Allow a small 8-second window on startup to bypass existing cached entries of Firestore
            if (changeTime > this.listenerStartedAt - 8000) {
              const category = addedData.category || 'system';
              const priority = addedData.priority || 'medium';
              const settings = settingsGetter();

              // Check if in-app/push alerts are toggled ON in preferences
              const inAppOn = settings.notificationsOn !== false; // default true
              const pushOn = settings.pushOn !== false; // default true
              const soundsOn = settings.soundOn !== false; // default true
              const vibrationsOn = settings.vibrationOn !== false; // default true

              // Category filters
              let allowed = true;
              if (category === 'inventory' && settings.lowStockNotify === false) allowed = false;
              if (category === 'udhar' && settings.udharNotify === false) allowed = false;
              if (category === 'analytics' && settings.dailySummaryNotify === false) allowed = false;

              if (allowed) {
                hasNewNotificationObj = {
                  id: change.doc.id,
                  title: addedData.title || '',
                  message: addedData.message || '',
                  timestamp: addedData.timestamp || new Date().toISOString(),
                  category,
                  priority,
                  isRead: addedData.isRead ?? false,
                  deepLink: addedData.deepLink,
                };
                if (priority === 'high') {
                  hasNewHighPriority = true;
                }
                
                // Trigger sound & vibration parameters
                if (soundsOn) {
                  playNotificationChime(priority);
                }
                if (vibrationsOn) {
                  triggerVibration(priority);
                }

                // Trigger browser notification
                if (pushOn && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(addedData.title || 'TS Price Manager Alert', {
                      body: addedData.message || '',
                      icon: '/avatar.png',
                      tag: 'ts_pm_' + change.doc.id,
                      requireInteraction: priority === 'high'
                    });
                  } catch (err) {
                    console.warn('Silent device fallback triggered', err);
                  }
                }
              }
            }
          }
        });

        onNotificationsUpdate(list);

        // Perform standard size-cap auto-cleanup in background if count exceeds 150
        if (list.length > 150) {
          this.autoCleanupNotifications(userId, list).catch(console.error);
        }
      },
      (error) => {
        console.error('Error fetching real-time notifications list:', error);
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`);
      }
    );
  }

  /**
   * Terminate listeners.
   */
  public static destroyNotificationSync() {
    if (this.listenerUnsubscribe) {
      this.listenerUnsubscribe();
      this.listenerUnsubscribe = null;
    }
    if (this.onMessageUnsubscribe) {
      this.onMessageUnsubscribe();
      this.onMessageUnsubscribe = null;
    }
  }

  /**
   * Capture custom FCM token or mock unique token and register current browser session with user.
   */
  private static async registerCurrentDevice(userId: string) {
    if (!userId || userId === 'guest_user') return;
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.warn('registerCurrentDevice deferred: Auth state not fully ready/matched.');
      return;
    }
    const deviceId = getOrCreateDeviceId();
    try {
      let fcmToken = localStorage.getItem('ts_pm_fcm_token');
      try {
        const messaging = await getMessagingInstance();
        if (messaging && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: 'BMZytTkcXxgomNS9TrB0-cgqGbWG__1AeDGUUjSJy5V5OCMO79WYXnmCFaPio4YZxZGVGoI27e3WrFKQSxGbrJ0'
          });
          if (token) {
            fcmToken = token;
            localStorage.setItem('ts_pm_fcm_token', fcmToken);
            console.log('[NotificationService] Acquired actual FCM Push Token:', fcmToken);
          }
        }
      } catch (tokenErr) {
        console.warn('[NotificationService] Real FCM registration failed (falling back to cached/mock token):', tokenErr);
      }

      if (!fcmToken) {
        fcmToken = 'fcm_' + Math.random().toString(36).substring(2, 15) + '_' + userId.substring(0, 5) + '_' + deviceId;
        localStorage.setItem('ts_pm_fcm_token', fcmToken);
      }

      const deviceData: DeviceRegistration = {
        id: deviceId,
        fcmToken: fcmToken,
        deviceName: (navigator.userAgent.includes('Mobile') ? 'Mobile User Agent' : 'Desktop User Agent') + ' (' + deviceId.substring(0, 6) + ')',
        updatedAt: new Date().toISOString()
      };

      const devDocRef = doc(db, 'users', userId, 'devices', deviceId);
      await setDoc(devDocRef, sanitizeForFirestore(deviceData));
    } catch (e) {
      console.error('Device registration token synchronization failed', e);
      handleFirestoreError(e, OperationType.WRITE, `users/${userId}/devices/${deviceId}`);
    }
  }

  /**
   * Inject/trigger in-app notification securely (local + Cloud synced).
   */
  public static async triggerNotification(
    userId: string | null,
    notif: Omit<InAppNotification, 'id' | 'isRead'>
  ): Promise<string> {
    const fallbackId = 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // Play local reactions instantly for real-time responsiveness even if offline or pending write
    playNotificationChime(notif.priority);
    triggerVibration(notif.priority);

    if (!userId || userId === 'guest_user') {
      // Local storage fallback when user is logged out / offline cache only
      const cached = JSON.parse(localStorage.getItem('ts_cached_offline_notifications') || '[]');
      const localNotif = { ...notif, id: fallbackId, isRead: false };
      localStorage.setItem('ts_cached_offline_notifications', JSON.stringify([localNotif, ...cached]));
      return fallbackId;
    }

    try {
      const notifsRef = collection(db, 'users', userId, 'notifications');
      const docRef = doc(notifsRef);
      await setDoc(docRef, sanitizeForFirestore({
        ...notif,
        id: docRef.id,
        isRead: false
      }));
      return docRef.id;
    } catch (err) {
      console.warn('Network offline or database mismatch. Local caching notification.', err);
      const cached = JSON.parse(localStorage.getItem('ts_cached_offline_notifications') || '[]');
      const localNotif = { ...notif, id: fallbackId, isRead: false };
      localStorage.setItem('ts_cached_offline_notifications', JSON.stringify([localNotif, ...cached]));
      return fallbackId;
    }
  }

  /**
   * Broadcast/Topic notification sends an alert to ALL registered device channels.
   */
  public static async broadcastToAllDevices(
    userId: string | null,
    title: string,
    message: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    category: 'system' | 'broadcast' = 'broadcast'
  ) {
    if (!userId || userId === 'guest_user') return;
    try {
      // Read all devices registered under the User profile in Firestore
      const devicesRef = collection(db, 'users', userId, 'devices');
      const snaps = await getDocs(devicesRef);
      const devicesList: string[] = [];
      snaps.forEach(s => {
        devicesList.push(s.data().deviceName || s.id);
      });

      // Insert database notification
      await this.triggerNotification(userId, {
        title: title,
        message: `${message} [Sent to ${devicesList.length || 1} Registered Devices]`,
        priority: priority,
        category: category,
        timestamp: new Date().toISOString(),
        deepLink: { screen: 'settings' }
      });
    } catch (err) {
      console.error('Broadcast execution error', err);
    }
  }

  /**
   * Set specific notification as read.
   */
  public static async markAsRead(userId: string | null, notificationId: string) {
    if (!userId || userId === 'guest_user') {
      // Offline fallback edit
      const cached: InAppNotification[] = JSON.parse(localStorage.getItem('ts_cached_offline_notifications') || '[]');
      const idx = cached.findIndex(n => n.id === notificationId);
      if (idx !== -1) {
        cached[idx].isRead = true;
        localStorage.setItem('ts_cached_offline_notifications', JSON.stringify(cached));
      }
      return;
    }

    try {
      if (notificationId.startsWith('notif_')) {
        // Was offline local cached, can update cached
        const cached: InAppNotification[] = JSON.parse(localStorage.getItem('ts_cached_offline_notifications') || '[]');
        const idx = cached.findIndex(n => n.id === notificationId);
        if (idx !== -1) {
          cached[idx].isRead = true;
          localStorage.setItem('ts_cached_offline_notifications', JSON.stringify(cached));
        }
        return;
      }
      const docRef = doc(db, 'users', userId, 'notifications', notificationId);
      await setDoc(docRef, { isRead: true }, { merge: true });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }

  /**
   * Set ALL user notifications as read.
   */
  public static async markAllAsRead(userId: string | null, list: InAppNotification[]) {
    // Local fallback update
    localStorage.setItem('ts_cached_offline_notifications', JSON.stringify([]));

    if (!userId || userId === 'guest_user') return;
    try {
      const batch = writeBatch(db);
      list.forEach((notif) => {
        if (!notif.isRead && !notif.id.startsWith('notif_')) {
          const docRef = doc(db, 'users', userId, 'notifications', notif.id);
          batch.update(docRef, { isRead: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error('Batch read confirmation failed', err);
    }
  }

  /**
   * Delete specific notification.
   */
  public static async deleteNotification(userId: string | null, notificationId: string) {
    const cached: InAppNotification[] = JSON.parse(localStorage.getItem('ts_cached_offline_notifications') || '[]');
    const filteredCached = cached.filter(n => n.id !== notificationId);
    localStorage.setItem('ts_cached_offline_notifications', JSON.stringify(filteredCached));

    if (!userId || userId === 'guest_user') return;
    try {
      if (notificationId.startsWith('notif_')) return;
      const docRef = doc(db, 'users', userId, 'notifications', notificationId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Delete notification failed', err);
    }
  }

  /**
   * Automatic background cleanup to prune excessive alerts in Firestore database.
   */
  private static async autoCleanupNotifications(userId: string, list: InAppNotification[]) {
    if (!userId || userId === 'guest_user') return;
    try {
      // Keep latest 80 notices and discard the rest.
      const toDelete = list.slice(80);
      if (toDelete.length === 0) return;
      const batch = writeBatch(db);
      toDelete.forEach((notif) => {
        if (!notif.id.startsWith('notif_')) {
          const docRef = doc(db, 'users', userId, 'notifications', notif.id);
          batch.delete(docRef);
        }
      });
      await batch.commit();
      console.info(`Cleaned up ${toDelete.length} legacy notifications.`);
    } catch (err) {
      console.error('Cloud cleanup sequence interrupted', err);
    }
  }

  /**
   * Check and auto-generate daily sales summary reports inside Cloud notifications channel.
   */
  public static checkAndTriggerDailySummary(
    userId: string | null,
    bills: any[],
    settings: any,
    forceTrigger: boolean = false
  ) {
    if (!userId || userId === 'guest_user') return;
    if (settings.dailySummaryNotify === false) return;

    try {
      const lastSentDate = localStorage.getItem('last_daily_sum_sent');
      const todayStr = new Date().toDateString();

      // Trigger once per day or when explicitly forced (via admin sandbox or scheduler click)
      if (lastSentDate === todayStr && !forceTrigger) return;

      const summaryTime = settings.dailySummaryTime || "20:00";
      const [shour, smin] = summaryTime.split(':').map(Number);
      const currentTime = new Date();
      
      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();

      // Trigger daily warning summary if current time reaches or exceeds the daily threshold configured
      const isTargetTime = (currentHours > shour) || (currentHours === shour && currentMinutes >= smin);

      if (isTargetTime || forceTrigger) {
        // Calculate today's sales and profits
        const todayBills = bills.filter(b => {
          const billDate = new Date(b.timestamp);
          return billDate.toDateString() === todayStr;
        });

        const totalSalesSum = todayBills.reduce((acc, b) => acc + (b.total || 0), 0);
        const totalProfitSum = todayBills.reduce((acc, b) => acc + ((b.total || 0) - (b.subtotal * 0.8)), 0); // Approx cost ratio or actual cost

        const billCount = todayBills.length;

        // Custom business summary
        const rupeeSymbol = '₹';
        const titleText = `📊 Business Daily Summary / दैनिक सारांश`;
        const bodyText = `Today's Sales: ${rupeeSymbol}${totalSalesSum.toLocaleString(undefined, { minimumFractionDigits: 0 })} | Total Profit: ${rupeeSymbol}${Math.max(0, totalProfitSum).toLocaleString(undefined, { minimumFractionDigits: 0 })} | Invoice Transactions Count: ${billCount}. Click to examine analytics dashboard.`;

        this.triggerNotification(userId, {
          title: titleText,
          message: bodyText,
          priority: 'medium',
          category: 'analytics',
          timestamp: new Date().toISOString(),
          deepLink: { screen: 'analytics' }
        }).then(() => {
          localStorage.setItem('last_daily_sum_sent', todayStr);
        }).catch(console.error);
      }
    } catch (err) {
      console.warn('Daily report sequence halted due to incomplete metrics:', err);
    }
  }
}
