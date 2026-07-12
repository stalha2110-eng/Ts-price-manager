import { getCachedAccessToken } from '../firebase';

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
          scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
          callback: async (response: any) => {
            if (response.error) {
              console.error("GIS token callback error:", response.error);
              reject(new Error(`OAuth failed: ${response.error_description || response.error}`));
              return;
            }

            if (response.access_token) {
              const accessToken = response.access_token;

              // Fetch user email for this token so we know which Google account was used for contacts
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
                    localStorage.setItem('ts_google_contacts_email', email);
                    // Also dispatch an event so that components can refresh immediately
                    window.dispatchEvent(new Event('ts_contacts_email_changed'));
                  }
                }
              } catch (err) {
                console.warn("Failed to fetch Google userinfo email:", err);
              }

              // Cache the independent token
              localStorage.setItem('ts_google_contacts_token', accessToken);
              localStorage.setItem('ts_google_contacts_token_expiry', String(Date.now() + 3500 * 1000)); // 1 hour expiry

              resolve({ accessToken, email });
            } else {
              reject(new Error("No access token was returned. (कोई एक्सेस टोकन प्राप्त नहीं हुआ।)"));
            }
          },
          error_callback: (err: any) => {
            console.error("GIS Error callback:", err);
            reject(new Error(err?.message || "Google OAuth initialization error."));
          }
        });

        client.requestAccessToken();
      } catch (err: any) {
        console.error("Error starting Google OAuth flow:", err);
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
