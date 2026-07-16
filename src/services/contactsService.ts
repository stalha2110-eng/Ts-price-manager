import { loadGsiScript } from './googleDriveService';
import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleContact {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string;
  email?: string;
}

export function getIndependentContactsToken(): string | null {
  const token = localStorage.getItem('ts_google_contacts_token');
  const expiry = localStorage.getItem('ts_google_contacts_token_expiry');
  if (token && expiry) {
    if (Date.now() < Number(expiry)) {
      return token;
    }
  }
  return null;
}

export function requestIndependentContactsToken(): Promise<{ accessToken: string; email?: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGsiScript();
      const g = window as any;
      if (!g.google || !g.google.accounts || !g.google.accounts.oauth2) {
        throw new Error("Google Identity Services library is not loaded.");
      }

      const client = g.google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          const accessToken = response.access_token;
          if (!accessToken) {
            reject(new Error("Failed to retrieve access token from Google sign-in."));
            return;
          }

          let email: string | undefined;
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              email = userData.email;
            }
          } catch (e) {
            console.warn("[Contacts GSI] Failed to retrieve email:", e);
          }

          if (email) {
            localStorage.setItem('ts_google_contacts_email', email);
            window.dispatchEvent(new Event('ts_contacts_email_changed'));
          }

          localStorage.setItem('ts_google_contacts_token', accessToken);
          localStorage.setItem('ts_google_contacts_token_expiry', String(Date.now() + 3500 * 1000)); // 1 hour

          resolve({ accessToken, email });
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || "Google flow failed or popup blocked."));
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error("[Contacts GSI] auth initialization failed:", err);
      reject(new Error(err?.message || "Google Authentication initialization failed."));
    }
  });
}

export class ContactsService {
  /**
   * Fetch contacts from Google People API using the independent contacts token
   */
  static async fetchGoogleContacts(forceRefresh = false): Promise<GoogleContact[]> {
    let token = getIndependentContactsToken();

    // If we do not have a cached token, try to log in to obtain one independently
    if (!token || forceRefresh) {
      try {
        const result = await requestIndependentContactsToken();
        token = result.accessToken;
      } catch (err: any) {
        console.error("Failed to authenticate Google user for Contacts API independently:", err);
        throw new Error(err?.message || "Authentication failed. Please sign in with Google to access contacts.");
      }
    }

    if (!token) {
      throw new Error("No Google authorization token found.");
    }

    try {
      // Fetch up to 1000 connections with names, phoneNumbers and photos
      const response = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,photos,emailAddresses&pageSize=1000',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401) {
        // Token might have expired. Try logging in again once.
        if (!forceRefresh) {
          return this.fetchGoogleContacts(true);
        }
        throw new Error("Google session expired. Please sign in again.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Google People API Error:", errorData);
        throw new Error(errorData.error?.message || `Google API returned status ${response.status}`);
      }

      const data = await response.json();
      const connections = data.connections || [];

      // Map connection objects into clean GoogleContact interfaces
      const contacts: GoogleContact[] = [];

      for (const person of connections) {
        const resourceName = person.resourceName || Math.random().toString();
        
        // Extract display name
        const name = person.names?.[0]?.displayName || person.organizations?.[0]?.name || "Unnamed Contact";
        
        // Extract phone number - we filter or clean it
        const phoneNumbers = person.phoneNumbers || [];
        
        // Extract photo
        const photoUrl = person.photos?.[0]?.url && !person.photos?.[0]?.default ? person.photos[0].url : undefined;

        // Extract email
        const email = person.emailAddresses?.[0]?.value || undefined;

        if (phoneNumbers.length > 0) {
          // If a contact has multiple phone numbers, create entries or pick the first/primary one
          for (const phoneObj of phoneNumbers) {
            const rawPhone = phoneObj.value || "";
            // Clean phone number (keep digits/plus, remove spacing/dashes if desired, but we keep it legible)
            const cleanPhone = rawPhone.trim();
            if (cleanPhone) {
              contacts.push({
                id: `${resourceName}-${cleanPhone}`,
                name,
                phone: cleanPhone,
                photoUrl,
                email,
              });
            }
          }
        }
      }

      // Ensure all IDs are strictly unique to prevent duplicate React keys
      const seenIds = new Set<string>();
      const uniqueContacts: GoogleContact[] = [];
      for (const contact of contacts) {
        if (!seenIds.has(contact.id)) {
          seenIds.add(contact.id);
          uniqueContacts.push(contact);
        }
      }

      // Sort contacts alphabetically by name
      return uniqueContacts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err: any) {
      console.error("Error fetching Google Contacts:", err);
      throw err;
    }
  }
}
