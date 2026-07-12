import { useState, useEffect, useCallback } from 'react';
import { getCachedAccessToken, loginWithGoogle } from '../firebase';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'checking';

export interface SystemPermissions {
  notifications: PermissionState;
  contacts: PermissionState;
  microphone: PermissionState;
  camera: PermissionState;
}

export function useSystemPermissions() {
  const [permissions, setPermissions] = useState<SystemPermissions>({
    notifications: 'checking',
    contacts: 'checking',
    microphone: 'checking',
    camera: 'checking',
  });

  const [isRequesting, setIsRequesting] = useState<string | null>(null);

  // Check current permission states
  const checkPermissions = useCallback(async () => {
    const nextStates: SystemPermissions = {
      notifications: 'prompt',
      contacts: 'prompt',
      microphone: 'prompt',
      camera: 'prompt',
    };

    // 1. Notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        nextStates.notifications = 'granted';
      } else if (Notification.permission === 'denied') {
        nextStates.notifications = 'denied';
      } else {
        nextStates.notifications = 'prompt';
      }
    } else {
      nextStates.notifications = 'denied'; // Not supported
    }

    // 2. Google Contacts (via access token presence)
    try {
      const hasToken = !!getCachedAccessToken();
      nextStates.contacts = hasToken ? 'granted' : 'prompt';
    } catch {
      nextStates.contacts = 'prompt';
    }

    // 3. Microphone permission query
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const micStatus = await navigator.permissions.query({ name: 'microphone' as any });
        nextStates.microphone = micStatus.state === 'granted' 
          ? 'granted' 
          : micStatus.state === 'denied' ? 'denied' : 'prompt';
          
        micStatus.onchange = () => {
          setPermissions(prev => ({
            ...prev,
            microphone: micStatus.state === 'granted' ? 'granted' : micStatus.state === 'denied' ? 'denied' : 'prompt'
          }));
        };
      } catch {
        // Fallback if query is unsupported
        nextStates.microphone = 'prompt';
      }
    }

    // 4. Camera permission query
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const camStatus = await navigator.permissions.query({ name: 'camera' as any });
        nextStates.camera = camStatus.state === 'granted' 
          ? 'granted' 
          : camStatus.state === 'denied' ? 'denied' : 'prompt';

        camStatus.onchange = () => {
          setPermissions(prev => ({
            ...prev,
            camera: camStatus.state === 'granted' ? 'granted' : camStatus.state === 'denied' ? 'denied' : 'prompt'
          }));
        };
      } catch {
        // Fallback if query is unsupported
        nextStates.camera = 'prompt';
      }
    }

    setPermissions(nextStates);
  }, []);

  // Request Notification permission
  const requestNotifications = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    setIsRequesting('notifications');
    try {
      const result = await Notification.requestPermission();
      const state = result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
      setPermissions(prev => ({ ...prev, notifications: state }));
      return result === 'granted';
    } catch (err) {
      console.error("Failed requesting notification permission", err);
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
      return false;
    } finally {
      setIsRequesting(null);
    }
  };

  // Request Microphone permission
  const requestMicrophone = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false;
    }
    setIsRequesting('microphone');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Successfully captured, so permission is granted. Stop track immediately.
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      return true;
    } catch (err) {
      console.error("Failed requesting microphone permission", err);
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      return false;
    } finally {
      setIsRequesting(null);
    }
  };

  // Request Camera permission
  const requestCamera = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false;
    }
    setIsRequesting('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Successfully captured, so permission is granted. Stop track immediately.
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      return true;
    } catch (err) {
      console.error("Failed requesting camera permission", err);
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return false;
    } finally {
      setIsRequesting(null);
    }
  };

  // Request Google Contacts (triggers OAuth Sign In)
  const requestContacts = async (): Promise<boolean> => {
    setIsRequesting('contacts');
    try {
      await loginWithGoogle();
      setPermissions(prev => ({ ...prev, contacts: 'granted' }));
      return true;
    } catch (err) {
      console.error("Failed requesting Google Contacts token", err);
      setPermissions(prev => ({ ...prev, contacts: 'denied' }));
      return false;
    } finally {
      setIsRequesting(null);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    permissions,
    isRequesting,
    checkPermissions,
    requestNotifications,
    requestMicrophone,
    requestCamera,
    requestContacts,
  };
}
