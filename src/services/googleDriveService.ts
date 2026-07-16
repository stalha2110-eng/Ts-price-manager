import { getIndependentContactsToken } from './contactsService';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, linkWithPopup, reauthenticateWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export function getIndependentDriveToken(): string | null {
  const token = localStorage.getItem('ts_google_drive_token');
  const expiry = localStorage.getItem('ts_google_drive_token_expiry');
  if (token && expiry) {
    if (Date.now() < Number(expiry)) {
      return token;
    }
  }
  return null;
}

export function requestIndependentDriveToken(): Promise<{ accessToken: string; email?: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');

      let result;
      const currentUser = auth.currentUser;

      if (currentUser && currentUser.uid !== 'guest_user') {
        // Safe Session-Preserving Google Auth Linking
        try {
          console.log("[Drive OAuth] Attempting to link Google Drive scopes to current user...");
          result = await linkWithPopup(currentUser, provider);
        } catch (linkErr: any) {
          console.warn("[Drive OAuth] linkWithPopup failed, attempting reauthenticateWithPopup...", linkErr);
          if (linkErr.code === 'auth/provider-already-linked' || linkErr.code === 'auth/credential-already-in-use') {
            try {
              result = await reauthenticateWithPopup(currentUser, provider);
            } catch (reauthErr) {
              console.warn("[Drive OAuth] reauthenticateWithPopup failed, falling back to signInWithPopup...", reauthErr);
              result = await signInWithPopup(auth, provider);
            }
          } else {
            console.warn("[Drive OAuth] linkWithPopup failed with other error, falling back to signInWithPopup...");
            result = await signInWithPopup(auth, provider);
          }
        }
      } else {
        // For guest/new sessions, use direct signInWithPopup
        result = await signInWithPopup(auth, provider);
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        reject(new Error("Failed to get Google Access Token from Firebase auth popup. (फायरबेस ऑथ पॉपअप से गूगल एक्सेस टोकन प्राप्त करने में असमर्थ।)"));
        return;
      }

      const accessToken = credential.accessToken;
      const email = result.user.email || undefined;

      if (email) {
        localStorage.setItem('ts_google_drive_email', email);
        // Also dispatch an event so that components can refresh immediately
        window.dispatchEvent(new Event('ts_drive_email_changed'));
      }

      // Cache the independent token
      localStorage.setItem('ts_google_drive_token', accessToken);
      localStorage.setItem('ts_google_drive_token_expiry', String(Date.now() + 3500 * 1000)); // 1 hour expiry

      resolve({ accessToken, email });
    } catch (err: any) {
      console.error("Firebase popup authentication failed for Drive:", err);
      reject(new Error(err?.message || "Google Authentication failed. Please check permissions and popups."));
    }
  });
}

export class GoogleDriveService {
  /**
   * Get dynamic authorized token for Drive API, auto-refreshes if possible or fails
   */
  static async getValidToken(): Promise<string> {
    let token = getIndependentDriveToken();
    if (!token) {
      // Try to obtain new token
      const result = await requestIndependentDriveToken();
      token = result.accessToken;
    }
    if (!token) {
      throw new Error("Google Drive is not connected. Please connect Google Drive in the profile screen.");
    }
    return token;
  }

  /**
   * Helper to query Google Drive for folder or file
   */
  static async findFileOrFolder(name: string, mimeType: string, parentId?: string): Promise<string | null> {
    const token = await this.getValidToken();
    let q = `name = '${name}' and mimeType = '${mimeType}' and trashed = false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Retry once after forcing re-auth
        localStorage.removeItem('ts_google_drive_token');
        const refreshedToken = await this.getValidToken();
        const retryRes = await fetch(url, {
          headers: { Authorization: `Bearer ${refreshedToken}` }
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          return data.files?.[0]?.id || null;
        }
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to search file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files?.[0]?.id || null;
  }

  /**
   * Creates a folder in Google Drive (or returns existing one)
   */
  static async getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    const token = await this.getValidToken();
    const existingId = await this.findFileOrFolder(folderName, 'application/vnd.google-apps.folder', parentId);
    if (existingId) {
      return existingId;
    }

    // Create the folder
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create folder ${folderName}`);
    }

    const folder = await response.json();
    return folder.id;
  }

  /**
   * Main function to upload a file to Google Drive using multipart upload
   */
  static async uploadFile(
    filename: string,
    mimeType: string,
    content: Blob | string,
    parentFolderId?: string
  ): Promise<any> {
    const token = await this.getValidToken();

    // Check if file already exists in this folder to avoid simple duplicates (or update it, or let it create a new version)
    // We will append a timestamp or let it create to have historical backup trails. Let's create new.
    const metadata: any = {
      name: filename,
      mimeType: mimeType
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const boundary = 'foo_bar_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let mediaDataPromise: Promise<string>;
    if (content instanceof Blob) {
      mediaDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 part
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(content);
      });
    } else {
      mediaDataPromise = Promise.resolve(btoa(unescape(encodeURIComponent(content))));
    }

    const base64Content = await mediaDataPromise;

    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Transfer-Encoding: base64\r\n' +
      `Content-Type: ${mimeType}\r\n\r\n` +
      base64Content +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to upload file ${filename}`);
    }

    return await response.json();
  }

  /**
   * Helper to structure and upload backups into dedicated subfolders
   */
  static async getAppBackupStructure(): Promise<{
    rootFolderId: string;
    billsFolderId: string;
    inventoryFolderId: string;
    systemFolderId: string;
  }> {
    const rootFolderId = await this.getOrCreateFolder('TS Price Manager Backups');
    const billsFolderId = await this.getOrCreateFolder('Invoices & Bills', rootFolderId);
    const inventoryFolderId = await this.getOrCreateFolder('Inventory & Products', rootFolderId);
    const systemFolderId = await this.getOrCreateFolder('System Backups', rootFolderId);

    return { rootFolderId, billsFolderId, inventoryFolderId, systemFolderId };
  }

  /**
   * Direct Action: Backup current full state
   */
  static async backupSystemState(systemState: { items: any[]; bills: any[]; notes: any[] }): Promise<string> {
    const structure = await this.getAppBackupStructure();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `TS_Price_Manager_Full_Backup_${timestamp}.json`;
    const jsonString = JSON.stringify(systemState, null, 2);

    const result = await this.uploadFile(filename, 'application/json', jsonString, structure.systemFolderId);
    return result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
  }

  /**
   * Direct Action: Backup single PDF invoice
   */
  static async uploadInvoicePDF(filename: string, pdfBlob: Blob): Promise<string> {
    const structure = await this.getAppBackupStructure();
    const result = await this.uploadFile(filename, 'application/pdf', pdfBlob, structure.billsFolderId);
    return result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
  }

  /**
   * Direct Action: Backup single CSV/TXT ledger
   */
  static async uploadLedgerCSV(filename: string, csvContent: string): Promise<string> {
    const structure = await this.getAppBackupStructure();
    const result = await this.uploadFile(filename, 'text/csv', csvContent, structure.inventoryFolderId);
    return result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
  }

  /**
   * Fetch a list of JSON backup files from Google Drive using REST API
   */
  static async listBackupFiles(mimeType?: string): Promise<Array<{ id: string; name: string; mimeType: string; createdTime?: string; size?: string }>> {
    const token = await this.getValidToken();
    let q = "trashed = false";
    if (mimeType) {
      q += ` and mimeType = '${mimeType}'`;
    } else {
      q += " and mimeType = 'application/json'";
    }
    // Optimize search for TS Price Manager backup files specifically (speeds up Drive response significantly)
    q += " and (name contains 'TS_Price_Manager_Full_Backup' or name contains 'TS_PRICE_MANAGER_Backup')";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,size)&orderBy=createdTime desc&pageSize=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('ts_google_drive_token');
        const refreshedToken = await this.getValidToken();
        const retryRes = await fetch(url, {
          headers: { Authorization: `Bearer ${refreshedToken}` }
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          return data.files || [];
        }
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch files from Google Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Use Google Picker to pick a file from Google Drive
   */
  static async openFilePicker(allowedMimeTypes?: string): Promise<{ id: string; name: string; mimeType: string } | null> {
    const token = await this.getValidToken();
    await loadPickerApi();

    return new Promise((resolve, reject) => {
      const g = window as any;
      if (!g.google || !g.google.picker) {
        reject(new Error("Google Picker is not loaded."));
        return;
      }

      let pickerOrigin = window.location.origin;
      try {
        if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
          pickerOrigin = window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1];
        }
      } catch (originErr) {
        console.warn("[Picker] Access to ancestorOrigins blocked, using fallback origin:", pickerOrigin);
      }

      try {
        const view = new g.google.picker.DocsView(g.google.picker.ViewId.DOCS);
        if (allowedMimeTypes) {
          view.setMimeTypes(allowedMimeTypes);
        }

        const projectNumber = (firebaseConfig as any).messagingSenderId || (firebaseConfig as any).projectId;

        const picker = new g.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(firebaseConfig.apiKey)
          .setAppId(projectNumber)
          .setOrigin(pickerOrigin)
          .setCallback((data: any) => {
            if (data.action === g.google.picker.Action.PICKED) {
              const doc = data.docs?.[0];
              if (doc) {
                resolve({
                  id: doc.id,
                  name: doc.name,
                  mimeType: doc.mimeType
                });
              } else {
                resolve(null);
              }
            } else if (data.action === g.google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();

        picker.setVisible(true);
      } catch (err: any) {
        console.error("Error building Google Picker:", err);
        reject(err);
      }
    });
  }

  /**
   * Download file content directly from Google Drive
   */
  static async downloadFileContent(fileId: string): Promise<any> {
    const token = await this.getValidToken();
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to download file from Google Drive: ${response.statusText}`);
    }
    return await response.json();
  }
}

let pickerLoadPromise: Promise<void> | null = null;

/**
 * Loads the Google Picker API (GAPI + Picker client library)
 */
export function loadPickerApi(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise;

  pickerLoadPromise = new Promise((resolve, reject) => {
    const g = window as any;
    if (g.gapi && g.google && g.google.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const gapi = g.gapi;
      if (!gapi) {
        reject(new Error("Google API (gapi) library failed to load."));
        return;
      }
      gapi.load('client:picker', {
        callback: () => {
          if (g.google && g.google.picker) {
            resolve();
          } else {
            reject(new Error("Google Picker library failed to load after gapi loaded."));
          }
        },
        onerror: () => {
          reject(new Error("Failed to load Picker client library."));
        }
      });
    };
    script.onerror = () => {
      reject(new Error("Failed to load Google API loader script."));
    };
    document.head.appendChild(script);
  });

  return pickerLoadPromise;
}
