/**
 * Google Drive Storage & Backup Integration Service
 * Completely isolated from Firebase Auth and Firestore state sync to guarantee zero regression or sync disruption.
 */

import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google: any;
  }
}

export interface DriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

// Drive API Scopes
export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Memory storage for Drive Access Token
let driveAccessToken: string | null = null;
let tokenExpirationTime: number = 0;

/**
 * Helper to safely obtain Google OAuth Client ID from env or firebase config
 */
export function getGoogleClientId(): string {
  if (import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }
  const cfg: any = firebaseConfig;
  const config = cfg?.default || cfg;
  if (config?.oAuthClientId) {
    return config.oAuthClientId;
  }
  return '';
}

/**
 * Load Google Accounts GIS script dynamically if not present
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Check if current user has an active Google Drive token stored in memory
 */
export function isDriveConnected(): boolean {
  if (!driveAccessToken) return false;
  return Date.now() < tokenExpirationTime;
}

/**
 * Get current Drive access token or throw if unauthenticated
 */
export function getDriveAccessToken(): string | null {
  if (driveAccessToken && Date.now() < tokenExpirationTime) {
    return driveAccessToken;
  }
  return null;
}

/**
 * Disconnect Google Drive session
 */
export function disconnectDrive(): void {
  driveAccessToken = null;
  tokenExpirationTime = 0;
  try {
    localStorage.removeItem('ts_drive_token_meta');
  } catch {
    // Ignore storage issues
  }
}

/**
 * Prompt user for Google Drive OAuth Authorization via Google GIS Token Client
 */
export async function requestDriveAuthorization(): Promise<string> {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    try {
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Accounts Client (GSI) failed to load.');
      }

      // Read client_id from standard env or fallback to app client ID if configured
      const clientId = getGoogleClientId();

      if (!clientId) {
        throw new Error('Google OAuth Client ID is missing. Please ensure firebase-applet-config.json or VITE_GOOGLE_CLIENT_ID is configured.');
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: (response: any) => {
          if (response.error) {
            console.error('[Drive Auth Error]', response);
            reject(new Error(response.error_description || response.error || 'Google Drive authorization failed'));
            return;
          }

          if (response.access_token) {
            driveAccessToken = response.access_token;
            // Token typically expires in 3600 seconds (1 hour). Subtract 5 mins buffer
            const expiresIn = (response.expires_in || 3600) * 1000;
            tokenExpirationTime = Date.now() + expiresIn - (5 * 60 * 1000);
            
            try {
              localStorage.setItem('ts_drive_connected', 'true');
            } catch {
              // ignore
            }

            resolve(response.access_token);
          } else {
            reject(new Error('No access token returned from Google Drive OAuth prompt.'));
          }
        },
        error_callback: (err: any) => {
          console.error('[Drive Token Client Error]', err);
          reject(new Error(err?.message || 'Drive OAuth prompt dismissed or blocked.'));
        }
      });

      // Request explicit consent
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('[Drive Auth Exception]', err);
      reject(err);
    }
  });
}

/**
 * Upload JSON backup payload directly to user's Google Drive
 */
export async function uploadBackupToDrive(
  jsonData: object | string,
  filename?: string
): Promise<DriveBackupFile> {
  const token = getDriveAccessToken() || (await requestDriveAuthorization());

  const fileName = filename || `TS_PRICE_MANAGER_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fileContent = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'TS Price Manager POS Database Backup'
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append(
    'file',
    new Blob([fileContent], { type: 'application/json' })
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,modifiedTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Drive Upload Error]', errText);
    if (response.status === 401) {
      disconnectDrive();
      throw new Error('Google Drive authorization expired. Please reconnect Google Drive.');
    }
    throw new Error(`Google Drive upload failed (${response.status}): ${errText}`);
  }

  const result: DriveBackupFile = await response.json();
  return result;
}

/**
 * List existing TS Price Manager JSON backup files in user's Google Drive
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = getDriveAccessToken() || (await requestDriveAuthorization());

  const query = "name contains 'TS_PRICE_MANAGER_Backup_' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink)&orderBy=createdTime desc&pageSize=20`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      disconnectDrive();
      throw new Error('Google Drive session expired. Please reconnect Google Drive.');
    }
    throw new Error(`Failed to query Google Drive files: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Download & parse backup JSON from Google Drive by File ID
 */
export async function downloadDriveBackup(fileId: string): Promise<any> {
  const token = getDriveAccessToken() || (await requestDriveAuthorization());

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      disconnectDrive();
      throw new Error('Google Drive authorization expired. Please reconnect.');
    }
    throw new Error(`Failed to download backup file from Drive: ${errText}`);
  }

  const json = await response.json();
  return json;
}
