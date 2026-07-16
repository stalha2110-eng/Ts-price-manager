import { getCachedAccessToken, auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, linkWithPopup, reauthenticateWithPopup } from 'firebase/auth';

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
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');

      let result;
      const currentUser = auth.currentUser;

      if (currentUser && currentUser.uid !== 'guest_user') {
        // Safe Session-Preserving Google Auth Linking
        try {
          console.log("[Contacts OAuth] Attempting to link Google Contacts scopes to current user...");
          result = await linkWithPopup(currentUser, provider);
        } catch (linkErr: any) {
          console.warn("[Contacts OAuth] linkWithPopup failed, attempting reauthenticateWithPopup...", linkErr);
          if (linkErr.code === 'auth/provider-already-linked' || linkErr.code === 'auth/credential-already-in-use') {
            try {
              result = await reauthenticateWithPopup(currentUser, provider);
            } catch (reauthErr) {
              console.warn("[Contacts OAuth] reauthenticateWithPopup failed, falling back to signInWithPopup...", reauthErr);
              result = await signInWithPopup(auth, provider);
            }
          } else {
            console.warn("[Contacts OAuth] linkWithPopup failed with other error, falling back to signInWithPopup...");
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
        localStorage.setItem('ts_google_contacts_email', email);
        // Also dispatch an event so that components can refresh immediately
        window.dispatchEvent(new Event('ts_contacts_email_changed'));
      }

      // Cache the independent token
      localStorage.setItem('ts_google_contacts_token', accessToken);
      localStorage.setItem('ts_google_contacts_token_expiry', String(Date.now() + 3500 * 1000)); // 1 hour expiry

      resolve({ accessToken, email });
    } catch (err: any) {
      console.error("Firebase popup authentication failed for Contacts:", err);
      reject(new Error(err?.message || "Google Authentication failed. Please check permissions and popups."));
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
