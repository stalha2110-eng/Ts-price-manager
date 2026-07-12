import { getIndependentContactsToken } from './contactsService';

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
  return new Promise((resolve, reject) => {
    const gsiScriptUrl = 'https://accounts.google.com/gsi/client';

    const triggerTokenRequest = () => {
      const g = (window as any).google;
      if (!g || !g.accounts || !g.accounts.oauth2) {
        reject(new Error("Google Identity Services client library not loaded. Please try again."));
        return;
      }

      // Exact client ID from firebase-applet-config.json
      const clientId = "389975625261-qsq3t8a74bvjuv6ju3udr4us99okibvk.apps.googleusercontent.com";

      try {
        const client = g.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
          callback: async (response: any) => {
            if (response.error) {
              console.error("GIS Drive token callback error:", response.error);
              reject(new Error(`OAuth failed: ${response.error_description || response.error}`));
              return;
            }

            if (response.access_token) {
              const accessToken = response.access_token;

              // Fetch user email for this token so we know which Google account was used for drive
              let email: string | undefined;
              try {
                const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: {
                    Authorization: `Bearer ${accessToken}`
                  }
                });
                if (userinfoRes.ok) {
                  const userInfo = await userinfoRes.json();
                  email = userInfo.email;
                  if (email) {
                    localStorage.setItem('ts_google_drive_email', email);
                    // Also dispatch an event so that components can refresh immediately
                    window.dispatchEvent(new Event('ts_drive_email_changed'));
                  }
                }
              } catch (err) {
                console.warn("Failed to fetch Google userinfo email:", err);
              }

              // Cache the independent token
              localStorage.setItem('ts_google_drive_token', accessToken);
              localStorage.setItem('ts_google_drive_token_expiry', String(Date.now() + 3500 * 1000)); // 1 hour expiry

              resolve({ accessToken, email });
            } else {
              reject(new Error("No access token was returned. (कोई एक्सेस टोकन प्राप्त नहीं हुआ।)"));
            }
          },
          error_callback: (err: any) => {
            console.error("GIS Drive Error callback:", err);
            reject(new Error(err?.message || "Google OAuth initialization error."));
          }
        });

        client.requestAccessToken();
      } catch (err: any) {
        console.error("Error starting Google OAuth flow for Drive:", err);
        reject(err);
      }
    };

    if (!(window as any).google || !(window as any).google.accounts) {
      const script = document.createElement('script');
      script.src = gsiScriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setTimeout(triggerTokenRequest, 100);
      };
      script.onerror = () => reject(new Error("Failed to load Google Sign-In script."));
      document.head.appendChild(script);
    } else {
      triggerTokenRequest();
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

      const pickerOrigin =
        window.location.ancestorOrigins &&
        window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      try {
        const view = new g.google.picker.DocsView(g.google.picker.ViewId.DOCS);
        if (allowedMimeTypes) {
          view.setMimeTypes(allowedMimeTypes);
        }

        const picker = new g.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
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

/**
 * Loads the Google Picker API (GAPI + Picker client library)
 */
export function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
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
}
