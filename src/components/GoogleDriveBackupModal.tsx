import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  CloudOff, 
  Upload, 
  Download, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive, 
  FileText, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  Database
} from 'lucide-react';
import { 
  isDriveConnected, 
  requestDriveAuthorization, 
  disconnectDrive, 
  uploadBackupToDrive, 
  listDriveBackups, 
  downloadDriveBackup, 
  DriveBackupFile 
} from '../services/driveService';
import { AppState } from '../types';
import { Button } from './ui/Button';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onRestoreData: (restoredState: any) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function GoogleDriveBackupModal({
  isOpen,
  onClose,
  state,
  onRestoreData,
  addToast
}: GoogleDriveBackupModalProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    const connected = isDriveConnected();
    setIsConnected(connected);
    if (connected) {
      await fetchDriveBackups();
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await requestDriveAuthorization();
      setIsConnected(true);
      addToast('Google Drive connected successfully!', 'success');
      await fetchDriveBackups();
    } catch (err: any) {
      console.error('[Drive Auth Error]', err);
      setErrorMsg(err.message || 'Failed to connect Google Drive.');
      addToast('Google Drive authorization was not completed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectDrive();
    setIsConnected(false);
    setBackups([]);
    addToast('Google Drive disconnected.', 'info');
  };

  const fetchDriveBackups = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const files = await listDriveBackups();
      setBackups(files);
    } catch (err: any) {
      console.error('[Drive List Error]', err);
      setErrorMsg(err.message || 'Failed to fetch backups from Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadBackup = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      // Build full backup payload
      const backupPayload = {
        appVersion: '3.1.0',
        exportedAt: new Date().toISOString(),
        storeName: state.settings.storeName || 'POS Store',
        state: state
      };

      const result = await uploadBackupToDrive(backupPayload);
      addToast(`Backup saved to Drive: ${result.name}`, 'success');
      await fetchDriveBackups();
    } catch (err: any) {
      console.error('[Drive Upload Error]', err);
      setErrorMsg(err.message || 'Failed to upload backup to Google Drive.');
      addToast('Backup upload to Google Drive failed.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestoreBackup = async (file: DriveBackupFile) => {
    if (!window.confirm(`Are you sure you want to restore backup from "${file.name}"? This will update your store records.`)) {
      return;
    }

    setIsRestoring(file.id);
    setErrorMsg(null);
    try {
      const data = await downloadDriveBackup(file.id);
      
      let restoredData = data;
      if (data.state) {
        restoredData = data.state;
      }

      if (!restoredData || typeof restoredData !== 'object') {
        throw new Error('Invalid or corrupted backup JSON file format.');
      }

      onRestoreData(restoredData);
      addToast('Store data successfully restored from Google Drive backup!', 'success');
      onClose();
    } catch (err: any) {
      console.error('[Drive Restore Error]', err);
      setErrorMsg(err.message || 'Failed to restore backup from Google Drive.');
      addToast('Failed to restore from Google Drive.', 'error');
    } finally {
      setIsRestoring(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[var(--card)] border border-[var(--border)] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--foreground)]/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-[var(--foreground)] flex items-center gap-2">
                  Google Drive Cloud Vault
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    Safe & Isolated
                  </span>
                </h3>
                <p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">
                  Backup & Restore Inventory Logs to personal Google Drive
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--foreground)]/50 hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {/* Safety Guarantee Notice */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px]">Zero Sync Disruption Guarantee</p>
                <p className="text-[11px] leading-relaxed text-indigo-300/90 font-normal">
                  Google Drive backups run as an independent vault layer. Connecting or disconnecting Google Drive will <strong>never interrupt</strong> your standard Firebase login session or Firestore database sync.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Connection Status Card */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--foreground)]/[0.015] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--foreground)]">
                    {isConnected ? 'Google Drive Connected' : 'Google Drive Disconnected'}
                  </p>
                  <p className="text-[10px] text-[var(--foreground)]/50 font-medium">
                    {isConnected ? 'Authorized via app-folder scope' : 'Click connect to authorize Drive backup uploads'}
                  </p>
                </div>
              </div>

              {isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  Connect Google Drive
                </button>
              )}
            </div>

            {/* Upload Backup Action */}
            {isConnected && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      <Upload className="w-4 h-4" /> Save New Backup to Drive
                    </h4>
                    <p className="text-[10px] text-[var(--foreground)]/60 font-medium mt-1">
                      Uploads catalog products, inventory stock levels, and bill history logs.
                    </p>
                  </div>
                  <Button
                    onClick={handleUploadBackup}
                    disabled={isUploading}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shrink-0"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Saving...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" /> Backup Now
                      </>
                    )}
                  </Button>
                </div>

                {/* Backups List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--foreground)]/70 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Available Drive Backups ({backups.length})
                    </h4>
                    <button
                      onClick={fetchDriveBackups}
                      disabled={isLoading}
                      className="text-[10px] font-bold text-amber-500 hover:underline uppercase flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh List
                    </button>
                  </div>

                  {isLoading && backups.length === 0 ? (
                    <div className="p-8 text-center text-xs font-medium text-[var(--foreground)]/50">
                      Loading backups from Google Drive...
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--border)] text-xs font-medium text-[var(--foreground)]/50">
                      No Google Drive backups found. Click "Backup Now" above to create your first cloud backup.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {backups.map((file) => (
                        <div
                          key={file.id}
                          className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--foreground)]/[0.015] hover:bg-[var(--foreground)]/[0.03] transition-all flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-[var(--foreground)] truncate">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-[var(--foreground)]/50 mt-1">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Recent'}
                              </span>
                              {file.size && (
                                <span className="font-mono">
                                  {(parseInt(file.size, 10) / 1024).toFixed(1)} KB
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
                                title="View in Google Drive"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRestoring === file.id}
                              onClick={() => handleRestoreBackup(file)}
                              className="rounded-xl border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-xs font-bold uppercase"
                            >
                              {isRestoring === file.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5 mr-1" /> Restore
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--foreground)]/[0.02] flex justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-bold uppercase text-xs px-6 py-2"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
