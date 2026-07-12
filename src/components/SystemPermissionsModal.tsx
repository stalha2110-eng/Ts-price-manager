import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Mic, Camera, UserCheck, ShieldAlert, CheckCircle2, AlertCircle, Play, X, HelpCircle } from 'lucide-react';
import { useSystemPermissions, PermissionState } from '../hooks/useSystemPermissions';

interface SystemPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemPermissionsModal: React.FC<SystemPermissionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    permissions,
    isRequesting,
    requestNotifications,
    requestMicrophone,
    requestCamera,
    requestContacts,
    checkPermissions
  } = useSystemPermissions();

  const [wizardError, setWizardError] = useState<string | null>(null);
  const [sequentialIndex, setSequentialIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRequest = async (key: 'notifications' | 'microphone' | 'camera' | 'contacts') => {
    setWizardError(null);
    let success = false;
    try {
      if (key === 'notifications') {
        success = await requestNotifications();
      } else if (key === 'microphone') {
        success = await requestMicrophone();
      } else if (key === 'camera') {
        success = await requestCamera();
      } else if (key === 'contacts') {
        success = await requestContacts();
      }

      if (!success) {
        // If they declined, give a friendly help prompt
        if (key === 'notifications') {
          setWizardError("Notification permission was denied. You can enable it in your browser settings. (नोटिफिकेशन ब्लॉक किया गया है।)");
        } else if (key === 'microphone') {
          setWizardError("Microphone access was denied. Please allow microphone access in browser settings. (माइक अनुमति अस्वीकार की गई है।)");
        } else if (key === 'camera') {
          setWizardError("Camera access was denied. Please enable camera access in browser settings. (कैमरा अनुमति अस्वीकार की गई है।)");
        } else if (key === 'contacts') {
          setWizardError("Google Contacts authorization was not completed. (गूगल कांटेक्ट ऑथराइजेशन पूरा नहीं हुआ।)");
        }
      }
    } catch (err: any) {
      setWizardError(err.message || `Failed requesting ${key} permission.`);
    }
    return success;
  };

  // Request all pending permissions sequentially
  const handleSequentialRequest = async () => {
    setWizardError(null);
    const order: Array<'notifications' | 'contacts' | 'microphone' | 'camera'> = [
      'notifications',
      'contacts',
      'microphone',
      'camera',
    ];

    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (permissions[key] === 'prompt') {
        setSequentialIndex(i);
        await handleRequest(key);
      }
    }
    setSequentialIndex(null);
  };

  const getStatusBadge = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return (
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={10} />
            <span>Granted / स्वीकृत</span>
          </span>
        );
      case 'denied':
        return (
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
            <ShieldAlert size={10} />
            <span>Denied / ब्लॉक</span>
          </span>
        );
      case 'prompt':
        return (
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <HelpCircle size={10} />
            <span>Prompt / मांगें</span>
          </span>
        );
      case 'checking':
      default:
        return (
          <span className="text-[8px] font-black uppercase tracking-wider text-gray-400 bg-gray-500/10 px-2.5 py-1 rounded-full animate-pulse">
            Checking...
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 150 }}
          className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-[2.5rem] p-6 shadow-2xl flex flex-col my-8 text-[var(--foreground)] relative overflow-hidden"
        >
          {/* Decorative Glowing Orbs */}
          <div className="absolute -left-16 -top-16 w-36 h-36 bg-[var(--primary)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -right-16 -bottom-16 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--border)] pb-4 mb-5 relative">
            <div className="space-y-1 text-left">
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-2.5 py-1 rounded-lg">
                🔐 System Permissions Center
              </span>
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] mt-2">
                Configure App Permissions (ऐप अनुमतियां)
              </h3>
              <p className="text-[10px] text-[var(--foreground)]/60 leading-tight">
                Authorize device features to enable high-end automation, voice narrations, and instant scanner capabilities.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/50 hover:text-[var(--foreground)] cursor-pointer active:scale-95 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Error Banner */}
          {wizardError && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-left overflow-hidden"
            >
              <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-rose-500 uppercase tracking-wider block">Access Warning / अस्वीकृत</span>
                <p className="text-[9px] font-semibold text-rose-400 leading-tight">{wizardError}</p>
              </div>
            </motion.div>
          )}

          {/* Permissions List */}
          <div className="flex-1 space-y-3 mb-6">
            {/* 1. Notifications */}
            <div className="p-3.5 bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.04] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-all duration-200">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bell size={16} className={isRequesting === 'notifications' ? 'animate-bounce' : ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-bold text-[10px] uppercase text-[var(--foreground)] leading-tight">
                      Alert Notifications
                    </h5>
                    {getStatusBadge(permissions.notifications)}
                  </div>
                  <p className="text-[9px] text-[var(--foreground)]/60 leading-relaxed mt-1">
                    Receive direct ledger alerts, dues reminders, and automatic data status indicators.
                  </p>
                  <span className="text-[8px] font-medium text-[var(--foreground)]/45 block mt-0.5">
                    खाता जोड़ने और उधार चुकाने की याद दिलाने के लिए नोटिफिकेशन प्राप्त करें।
                  </span>
                </div>
              </div>
              <button
                disabled={permissions.notifications === 'granted' || isRequesting !== null}
                onClick={() => handleRequest('notifications')}
                className={`py-1.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer text-center sm:self-center shrink-0 min-w-[100px] ${
                  permissions.notifications === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                    : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-sm'
                }`}
              >
                {permissions.notifications === 'granted' ? 'Enabled' : isRequesting === 'notifications' ? 'Requesting...' : 'Grant Access'}
              </button>
            </div>

            {/* 2. Google Contacts */}
            <div className="p-3.5 bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.04] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-all duration-200">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                  <UserCheck size={16} className={isRequesting === 'contacts' ? 'animate-pulse' : ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-bold text-[10px] uppercase text-[var(--foreground)] leading-tight">
                      Google Contacts Sync
                    </h5>
                    {getStatusBadge(permissions.contacts)}
                  </div>
                  <p className="text-[9px] text-[var(--foreground)]/60 leading-relaxed mt-1">
                    Import customer names and mobile phone numbers instantly from your Google account.
                  </p>
                  <span className="text-[8px] font-medium text-[var(--foreground)]/45 block mt-0.5">
                    अपने गूगल संपर्क से सीधे कस्टमर का नाम और नंबर लोड करें।
                  </span>
                </div>
              </div>
              <button
                disabled={permissions.contacts === 'granted' || isRequesting !== null}
                onClick={() => handleRequest('contacts')}
                className={`py-1.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer text-center sm:self-center shrink-0 min-w-[100px] ${
                  permissions.contacts === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                    : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-sm'
                }`}
              >
                {permissions.contacts === 'granted' ? 'Synced' : isRequesting === 'contacts' ? 'Connecting...' : 'Sync Google'}
              </button>
            </div>

            {/* 3. Microphone Access */}
            <div className="p-3.5 bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.04] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-all duration-200">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Mic size={16} className={isRequesting === 'microphone' ? 'animate-pulse' : ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-bold text-[10px] uppercase text-[var(--foreground)] leading-tight">
                      Microphone Audio
                    </h5>
                    {getStatusBadge(permissions.microphone)}
                  </div>
                  <p className="text-[9px] text-[var(--foreground)]/60 leading-relaxed mt-1">
                    Enable voice commands and vocal narration to record ledger summaries easily.
                  </p>
                  <span className="text-[8px] font-medium text-[var(--foreground)]/45 block mt-0.5">
                    आवाज़ से निर्देश और कमांड देने के लिए माइक का उपयोग करें।
                  </span>
                </div>
              </div>
              <button
                disabled={permissions.microphone === 'granted' || isRequesting !== null}
                onClick={() => handleRequest('microphone')}
                className={`py-1.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer text-center sm:self-center shrink-0 min-w-[100px] ${
                  permissions.microphone === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                    : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-sm'
                }`}
              >
                {permissions.microphone === 'granted' ? 'Enabled' : isRequesting === 'microphone' ? 'Opening...' : 'Grant Access'}
              </button>
            </div>

            {/* 4. Camera Access */}
            <div className="p-3.5 bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.04] border border-[var(--border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-all duration-200">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <Camera size={16} className={isRequesting === 'camera' ? 'animate-pulse' : ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5 className="font-bold text-[10px] uppercase text-[var(--foreground)] leading-tight">
                      Camera Scanner
                    </h5>
                    {getStatusBadge(permissions.camera)}
                  </div>
                  <p className="text-[9px] text-[var(--foreground)]/60 leading-relaxed mt-1">
                    Allows you to use the barcode scanner directly using your phone or web camera.
                  </p>
                  <span className="text-[8px] font-medium text-[var(--foreground)]/45 block mt-0.5">
                    बारकोड और क्यूआर कोड स्कैन करने के लिए कैमरा की अनुमति दें।
                  </span>
                </div>
              </div>
              <button
                disabled={permissions.camera === 'granted' || isRequesting !== null}
                onClick={() => handleRequest('camera')}
                className={`py-1.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer text-center sm:self-center shrink-0 min-w-[100px] ${
                  permissions.camera === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                    : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-sm'
                }`}
              >
                {permissions.camera === 'granted' ? 'Enabled' : isRequesting === 'camera' ? 'Opening...' : 'Grant Access'}
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-[var(--border)] pt-4">
            <button
              onClick={handleSequentialRequest}
              disabled={isRequesting !== null}
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-indigo-600 hover:from-[var(--primary)]/95 hover:to-indigo-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-[var(--primary)]/10 cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2 select-none disabled:opacity-50"
            >
              <Play size={11} className={sequentialIndex !== null ? 'animate-spin' : ''} />
              <span>
                {sequentialIndex !== null ? 'Requesting Sequentially...' : 'Authorize Remaining Sequentially'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80 font-black text-[10px] uppercase tracking-wider cursor-pointer active:scale-98 transition-all"
            >
              Skip / Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
