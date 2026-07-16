import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, RefreshCw, User, Phone, Mail, X, AlertCircle } from 'lucide-react';
import { ContactsService, GoogleContact, getIndependentContactsToken } from '../services/contactsService';

interface GoogleContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: GoogleContact) => void;
}

export const GoogleContactPickerModal: React.FC<GoogleContactPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
}) => {
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getIndependentContactsToken());
  const connectedEmail = localStorage.getItem('ts_google_contacts_email');

  const handleSwitchAccount = async () => {
    localStorage.removeItem('ts_google_contacts_email');
    localStorage.removeItem('ts_google_contacts_token');
    localStorage.removeItem('ts_google_contacts_token_expiry');
    window.dispatchEvent(new Event('ts_contacts_email_changed'));
    setIsAuthenticated(false);
    setError(null);
    // Directly request fresh login
    setIsLoading(true);
    try {
      await loadContacts(true);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContacts = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedContacts = await ContactsService.fetchGoogleContacts(forceRefresh);
      setContacts(fetchedContacts);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Error loading contacts", err);
      const msg = err.message || "";
      if (msg.includes("popup-closed-by-user")) {
        setError("Sign-In popup was closed before authorization. (साइन-इन पॉपअप बंद कर दिया गया था।)");
      } else if (msg.includes("popup-blocked")) {
        setError("Browser blocked the Sign-In popup. Please allow popups for this site. (पॉपअप ब्लॉक कर दिया गया है।)");
      } else {
        setError(msg || "Failed to load Google Contacts.");
      }
      
      // Check if unauthorized or token error
      if (
        msg.toLowerCase().includes("auth") || 
        msg.toLowerCase().includes("token") || 
        msg.toLowerCase().includes("expire") || 
        msg.toLowerCase().includes("sign in") ||
        msg.toLowerCase().includes("fail")
      ) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (getIndependentContactsToken()) {
        loadContacts();
      } else {
        setIsAuthenticated(false);
      }
    }
  }, [isOpen]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadContacts(true);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("popup-closed-by-user")) {
        setError("Sign-In popup was closed before authorization. (साइन-इन पॉपअप बंद कर दिया गया था।)");
      } else if (msg.includes("popup-blocked")) {
        setError("Browser blocked the Sign-In popup. Please allow popups for this site. (पॉपअप ब्लॉक कर दिया गया है।)");
      } else {
        setError(msg || "Failed to log in with Google.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      (contact.email && contact.email.toLowerCase().includes(query))
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] text-[var(--foreground)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
            <div className="space-y-0.5 text-left">
              <h4 className="font-bold text-xs uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
                Google Contacts
              </h4>
              <p className="text-[9px] text-[var(--foreground)]/60">Import customer details from your Google contacts</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 rounded-full hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/50 hover:text-[var(--foreground)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {!isAuthenticated ? (
            /* Login Prompt with Premium Troubleshooting Guide */
            <div className="flex-1 flex flex-col overflow-y-auto pr-1 space-y-5 py-2 no-scrollbar">
              {connectedEmail ? (
                /* Premium re-authorization screen when a session expires */
                <div className="flex flex-col items-center justify-center text-center space-y-4 shrink-0 py-3">
                  <div className="relative animate-bounce duration-1000">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-xl font-bold uppercase select-none">
                      {connectedEmail.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[var(--card)] flex items-center justify-center text-white text-[10px] font-bold">
                      ✓
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)]">Google Account Connected</h5>
                    <div className="font-mono text-[9px] bg-black/15 border border-[var(--border)] px-3 py-1 rounded-xl w-fit mx-auto text-[var(--foreground)]/90 select-all">
                      {connectedEmail}
                    </div>
                  </div>

                  <p className="text-[10px] text-[var(--foreground)]/60 max-w-[340px] leading-relaxed">
                    Google's secure access session expires every 1 hour. Tap <strong>'Load Contacts'</strong> to refresh your connection and retrieve your list instantly.
                    <br />
                    <span className="text-[9px] text-amber-500/95 font-medium mt-1.5 block">
                      (गूगल संपर्क सत्र हर 1 घंटे में समाप्त हो जाता है। संपर्क देखने के लिए नीचे लोड करें पर क्लिक करें।)
                    </span>
                  </p>

                  {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-left flex items-start gap-2 max-w-[380px] w-full">
                      <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-rose-500 block">ERROR / त्रुटि:</span>
                        <span className="text-[9px] font-bold text-rose-500 block leading-tight">{error}</span>
                      </div>
                    </div>
                  )}

                  <div className="w-full max-w-[280px] space-y-3 pt-1">
                    <button
                      onClick={handleLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--primary)] hover:opacity-90 active:scale-95 text-white rounded-2xl shadow-lg font-black text-[10px] uppercase tracking-widest cursor-pointer select-none transition-all duration-150 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                      <span>{isLoading ? 'Loading Contacts...' : '🔄 Load Contacts (संपर्क लोड करें)'}</span>
                    </button>

                    <button
                      onClick={handleSwitchAccount}
                      disabled={isLoading}
                      className="text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors underline cursor-pointer block mx-auto"
                    >
                      Switch Google Account (दूसरा खाता चुनें)
                    </button>
                  </div>
                </div>
              ) : (
                /* First-time login prompt */
                <div className="flex flex-col items-center justify-center text-center space-y-3 shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <User size={20} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)]">Connect Google Account</h5>
                    <p className="text-[10px] text-[var(--foreground)]/60 max-w-[340px] leading-relaxed">
                      Sign in with Google to grant access to your contacts list. This lets you search and import phone numbers and names instantly.
                    </p>
                  </div>

                  {window.self !== window.top && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left flex items-start gap-2.5 max-w-[380px] w-full text-[9.5px] text-amber-300 font-semibold leading-normal">
                      <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300 uppercase block tracking-wider text-[8.5px] mb-0.5">Iframe Sandbox Notice / आईफ्रेम चेतावनी</strong>
                        Since this app is in the AI Studio preview window (iframe), Google popups can be blocked or fail. If you face issues, click the <strong>"Open in a new tab"</strong> button at the top-right of your screen to authorize seamlessly!
                        <span className="text-[8.5px] text-gray-400 font-medium block mt-1 leading-normal">
                          (प्रिव्यू विंडो में गूगल सुरक्षा के कारण पॉपअप ब्लॉक हो सकता है। कृपया पूर्ण सुविधा के लिए एप को नए टैब में खोलें।)
                        </span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-left flex items-start gap-2 max-w-[380px] w-full">
                      <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-rose-500 block">ERROR / त्रुटि:</span>
                        <span className="text-[9px] font-bold text-rose-500 block leading-tight">{error}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="w-full max-w-[280px] flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-900 border border-gray-200 rounded-2xl shadow-md font-black text-[10px] uppercase tracking-wider cursor-pointer select-none transition-all duration-200 disabled:opacity-50"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}

              {/* Comprehensive visual warning bypass instructions */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-left space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <AlertCircle size={14} />
                  </div>
                  <div>
                    <h6 className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Bypass "Google hasn't verified safety" Warning
                    </h6>
                    <span className="text-[8px] text-amber-500/70 font-bold block uppercase leading-none mt-0.5">
                      सुरक्षा चेतावनी बाईपास करने के चरण
                    </span>
                  </div>
                </div>

                <p className="text-[9px] text-[var(--foreground)]/70 leading-relaxed font-semibold">
                  This warning appears because the app is currently in <span className="text-amber-400 font-bold">Developer Testing Mode</span> requesting secure Contacts access. It is <span className="text-emerald-400 font-black">100% SAFE</span> to proceed as it connects directly to your own secure Firebase portal.
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="text-[9px] leading-tight">
                      <strong className="text-amber-300 uppercase block tracking-wide">Click "Advanced" / "एडवांस्ड"</strong>
                      <span className="text-[var(--foreground)]/60">
                        On the Google error screen, click the <span className="underline font-bold text-amber-200">"Advanced"</span> link at the bottom-left.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="text-[9px] leading-tight">
                      <strong className="text-amber-300 uppercase block tracking-wide">Click "Go to [app] (unsafe)" / "आगे बढ़ें"</strong>
                      <span className="text-[var(--foreground)]/60">
                        Click the <span className="underline font-bold text-amber-200">"Go to ... (unsafe)"</span> link that appears at the bottom.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="text-[9px] leading-tight">
                      <strong className="text-amber-300 uppercase block tracking-wide">Check "Contacts" box & Allow / अनुमति दें</strong>
                      <span className="text-[var(--foreground)]/60">
                        Make sure to <span className="text-emerald-400 font-black uppercase">check/tick the checkbox</span> to grant permission to <span className="text-amber-200 font-bold">"See and download your contacts"</span>, then click <span className="font-bold text-amber-300">"Continue" / "जारी रखें"</span>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Contacts List */
            <div className="flex-1 flex flex-col overflow-hidden min-h-[350px]">
              {/* Search Bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={13} />
                  <input
                    type="text"
                    placeholder="Search name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-[10px] font-bold pl-8 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--foreground)]/[0.02] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <button
                  onClick={() => loadContacts(true)}
                  disabled={isLoading}
                  title="Refresh contacts"
                  className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--foreground)]/[0.05] text-[var(--foreground)]/70 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {error && (
                <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2">
                  <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-[9px] text-rose-500 font-bold flex-1 text-left">
                    <span>{error}</span>
                    <button onClick={handleLogin} className="block underline mt-1 font-black uppercase tracking-wider">
                      Re-Authorize
                    </button>
                  </div>
                </div>
              )}

              {/* Contacts Scroll list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar text-left">
                {isLoading && contacts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-center space-y-2 opacity-60">
                    <RefreshCw className="animate-spin text-[var(--primary)]" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Fetching Google Contacts...</span>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-center space-y-2 opacity-50 border border-dashed border-[var(--border)] rounded-2xl">
                    <User size={20} className="opacity-40" />
                    <span className="text-[10px] font-black uppercase tracking-wider">No contacts matching search</span>
                    <span className="text-[8px] opacity-75">Try another search or sync again.</span>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => onSelectContact(contact)}
                      className="p-3 bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.05] active:bg-[var(--foreground)]/[0.08] border border-[var(--border)] hover:border-[var(--primary)]/30 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {contact.photoUrl ? (
                          <img
                            src={contact.photoUrl}
                            referrerPolicy="no-referrer"
                            alt={contact.name}
                            className="w-8 h-8 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-black text-xs shrink-0 border border-[var(--primary)]/10 uppercase">
                            {contact.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h6 className="font-bold text-[10px] truncate uppercase leading-tight text-[var(--foreground)]">
                            {contact.name}
                          </h6>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono text-[var(--foreground)]/60 flex items-center gap-0.5">
                              <Phone size={8} className="opacity-40" />
                              {contact.phone}
                            </span>
                            {contact.email && (
                              <span className="text-[8px] text-[var(--foreground)]/40 truncate max-w-[120px] flex items-center gap-0.5">
                                <Mail size={8} className="opacity-40" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-wider text-[var(--primary)] bg-[var(--primary)]/5 px-2 py-1 rounded-lg group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                        Select
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
