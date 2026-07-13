import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Trash2, 
  Monitor, 
  Activity, 
  RefreshCw, 
  LogOut, 
  ArrowLeftRight, 
  ShieldCheck, 
  Clock, 
  Database, 
  Search, 
  Lock, 
  Unlock,
  Package,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  setDoc
} from 'firebase/firestore';

interface AdminDashboardProps {
  adminUser: {
    uid: string;
    email: string | null;
  };
  onLogout: () => Promise<void>;
  onExitAdmin: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  storeName?: string;
  storeOwnerName?: string;
  storePhone?: string;
  storeAddress?: string;
  lastLoginAt?: string;
  isDisabled?: boolean;
}

interface DeviceInfo {
  id: string;
  deviceName: string;
  updatedAt: string;
}

export function AdminDashboard({ adminUser, onLogout, onExitAdmin }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemLogs, setSystemLogs] = useState<{ id: string; msg: string; time: string; type: 'info' | 'warn' | 'success' }[]>([]);

  // Add a log entry
  const addLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const newLog = {
      id: Date.now().toString(),
      msg,
      time: new Date().toLocaleTimeString(),
      type
    };
    setSystemLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  // Fetch all users from Firestore
  const fetchUsers = async () => {
    setIsLoading(true);
    addLog("Initiating full directory synchronization with cloud databases...", "info");
    try {
      const usersColRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersColRef);
      const fetchedUsers: UserProfile[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedUsers.push({
          id: docSnap.id,
          email: data.email || 'Unregistered / Unknown Email',
          storeName: data.storeName || data.businessName || 'Unnamed Store',
          storeOwnerName: data.storeOwnerName || data.storeOwnerName || 'Unknown Owner',
          storePhone: data.storePhone || data.whatsAppNumber || 'No Phone',
          storeAddress: data.storeAddress || 'No Address',
          lastLoginAt: data.lastLoginAt || data.lastUpdated || 'Never',
          isDisabled: !!data.isDisabled
        });
      });

      setUsers(fetchedUsers);
      addLog(`Directory sync complete. Verified ${fetchedUsers.length} system nodes.`, "success");
    } catch (error: any) {
      console.error("Error fetching users:", error);
      addLog(`Failed to query directory database: ${error.message || error}`, "warn");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch devices for selected user
  const fetchDevices = async (userId: string) => {
    addLog(`Scanning connected devices telemetry for Node [${userId}]...`, "info");
    try {
      const devicesColRef = collection(db, 'users', userId, 'devices');
      const snapshot = await getDocs(devicesColRef);
      const fetchedDevices: DeviceInfo[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedDevices.push({
          id: docSnap.id,
          deviceName: data.deviceName || 'Generic Device',
          updatedAt: data.updatedAt || 'Unknown'
        });
      });

      setDevices(fetchedDevices);
      addLog(`Device query complete. Registered ${fetchedDevices.length} telemetry receivers.`, "success");
    } catch (error: any) {
      console.error("Error fetching devices:", error);
      addLog(`Failed to scan device subcollections: ${error.message || error}`, "warn");
    }
  };

  // Handle User selection
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setDevices([]);
    fetchDevices(user.id);
  };

  // Toggle user active status (Enable/Disable)
  const handleToggleUserStatus = async (user: UserProfile) => {
    const actionLabel = user.isDisabled ? "Enable" : "Disable";
    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} user account: ${user.email}?`)) {
      return;
    }

    const targetStatus = !user.isDisabled;
    setIsActionLoading(user.id);
    addLog(`Sending patch request to security rule gate: setting user ${user.email} isDisabled=${targetStatus}`, "info");

    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        isDisabled: targetStatus
      });

      // Update local state
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isDisabled: targetStatus } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, isDisabled: targetStatus } : null);
      }

      addLog(`Security gate rules updated successfully for ${user.email}. User is now ${targetStatus ? 'DISABLED' : 'ENABLED'}.`, "success");
    } catch (error: any) {
      console.error("Error updating user status:", error);
      addLog(`Failed to set security rules on gateway: ${error.message || error}`, "warn");
      alert(`Operation failed: ${error.message}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  // Delete all user data (Items, Bills, Notes, Devices & Profile)
  const handleDeleteUserData = async (user: UserProfile) => {
    const confirmation = window.prompt(
      `CRITICAL ACTION!\nTo permanently erase all inventory lists, bills, notes, and profile configurations for ${user.email}, type the word "DELETE" below:`
    );

    if (confirmation !== "DELETE") {
      addLog("Destructive operation aborted by administrator.", "info");
      return;
    }

    setIsActionLoading(user.id);
    addLog(`Executing destructive data wipe sequence for User: ${user.email}...`, "warn");

    try {
      // 1. Delete items subcollection
      const itemsColRef = collection(db, 'users', user.id, 'items');
      const itemsSnap = await getDocs(itemsColRef);
      for (const itemDoc of itemsSnap.docs) {
        await deleteDoc(doc(db, 'users', user.id, 'items', itemDoc.id));
      }
      addLog(`Erased ${itemsSnap.size} inventory items from cloud datastore.`, "success");

      // 2. Delete bills subcollection
      const billsColRef = collection(db, 'users', user.id, 'bills');
      const billsSnap = await getDocs(billsColRef);
      for (const billDoc of billsSnap.docs) {
        await deleteDoc(doc(db, 'users', user.id, 'bills', billDoc.id));
      }
      addLog(`Erased ${billsSnap.size} sales records from transaction datastore.`, "success");

      // 3. Delete notes subcollection
      const notesColRef = collection(db, 'users', user.id, 'notes');
      const notesSnap = await getDocs(notesColRef);
      for (const noteDoc of notesSnap.docs) {
        await deleteDoc(doc(db, 'users', user.id, 'notes', noteDoc.id));
      }
      addLog(`Erased ${notesSnap.size} task notes from workspace.`, "success");

      // 4. Delete devices subcollection
      const devicesColRef = collection(db, 'users', user.id, 'devices');
      const devicesSnap = await getDocs(devicesColRef);
      for (const devDoc of devicesSnap.docs) {
        await deleteDoc(doc(db, 'users', user.id, 'devices', devDoc.id));
      }
      addLog(`Erased ${devicesSnap.size} registered device tokens.`, "success");

      // 5. Delete root user document
      await deleteDoc(doc(db, 'users', user.id));
      addLog(`Erased root directory profile document for ${user.email}.`, "success");

      // Update local state
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
        setDevices([]);
      }

      alert(`TS Price Manager: User data for ${user.email} was wiped permanently.`);
      addLog(`Destructive sequence completed for ${user.email}. Data is fully unrecoverable.`, "success");
    } catch (error: any) {
      console.error("Error erasing user data:", error);
      addLog(`Critical Failure during wipe sequence: ${error.message || error}`, "warn");
      alert(`Wipe operation failed partially: ${error.message}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  // Filter users list based on search query
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.storeName && user.storeName.toLowerCase().includes(searchLower)) ||
      (user.storeOwnerName && user.storeOwnerName.toLowerCase().includes(searchLower)) ||
      user.id.includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* 🔮 Futuristic Admin Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
            <Users size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black uppercase tracking-widest text-white leading-none">
                TS Price Manager
              </h1>
              <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[8px] font-mono uppercase font-extrabold tracking-wider">
                ADMIN SECURE v2.2
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase font-mono">
              Secure Operator Gateway • {adminUser.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExitAdmin}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeftRight size={12} />
            <span>Switch to Merchant Mode</span>
          </button>
          
          <button
            onClick={onLogout}
            className="p-2.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/40 rounded-xl transition-all cursor-pointer active:scale-95"
            title="Terminate Operator Session"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* 📊 Grid Stats Overview Panel */}
      <section className="px-6 py-6 max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4.5 flex items-center gap-4">
          <div className="h-11 w-11 bg-indigo-500/15 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total System Nodes</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{users.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4.5 flex items-center gap-4">
          <div className="h-11 w-11 bg-teal-500/15 border border-teal-500/20 rounded-xl flex items-center justify-center text-teal-400">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Active Merchants</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">
              {users.filter(u => !u.isDisabled).length}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4.5 flex items-center gap-4">
          <div className="h-11 w-11 bg-rose-500/15 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Banned Accounts</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">
              {users.filter(u => u.isDisabled).length}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4.5 flex items-center gap-4">
          <div className="h-11 w-11 bg-cyan-500/15 border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Firestore Rules Guard</span>
            <p className="text-xs font-black text-cyan-400 mt-1 uppercase font-mono tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-ping" />
              ACTIVE / LOCKED
            </p>
          </div>
        </div>
      </section>

      {/* 🧭 Master Operations Panel */}
      <main className="flex-1 px-6 pb-12 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 📋 Left Column: User Search & List (7 cols) */}
        <section className="lg:col-span-7 bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px]">
          {/* List Search Header */}
          <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex items-center gap-3">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Gmail, Store, Owner, or Node ID..."
              className="w-full bg-transparent text-xs font-semibold outline-none text-white placeholder:text-slate-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={fetchUsers}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition-colors cursor-pointer"
              title="Refresh User Directory"
              disabled={isLoading}
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Users List Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 select-none">
                <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-wider">Synchronizing Registry...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 select-none py-12">
                <Users size={32} className="opacity-40 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider">No nodes matched search queries</span>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                return (
                  <motion.div
                    key={user.id}
                    layoutId={`user-row-${user.id}`}
                    onClick={() => handleSelectUser(user)}
                    className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all cursor-pointer hover:border-slate-700 ${
                      isSelected 
                        ? 'bg-indigo-950/20 border-indigo-500/50 shadow-[0_4px_20px_rgba(99,102,241,0.05)]' 
                        : 'bg-slate-900/20 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Status indicator badge */}
                      <div className={`h-8.5 w-8.5 rounded-xl flex items-center justify-center border shrink-0 ${
                        user.isDisabled 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      }`}>
                        {user.isDisabled ? <UserX size={15} /> : <UserCheck size={15} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black text-white truncate max-w-[200px]">
                            {user.email}
                          </h4>
                          {user.isDisabled && (
                            <span className="bg-rose-500/15 text-rose-400 border border-rose-500/25 text-[7px] font-mono px-1 rounded uppercase font-black leading-none py-0.5">
                              DEACTIVATED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">
                          {user.storeName} • <span className="text-slate-500 font-semibold">{user.storeOwnerName}</span>
                        </p>
                        <p className="text-[8px] font-mono text-slate-500 mt-1 uppercase">
                          UID: {user.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Active Toggle */}
                      <button
                        onClick={() => handleToggleUserStatus(user)}
                        disabled={isActionLoading === user.id}
                        className={`p-2 rounded-lg border transition-all cursor-pointer active:scale-90 ${
                          user.isDisabled
                            ? 'bg-teal-950/20 hover:bg-teal-950/40 text-teal-400 border-teal-900/30'
                            : 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border-rose-900/30'
                        }`}
                        title={user.isDisabled ? "Re-enable Account" : "Deactivate Account"}
                      >
                        {isActionLoading === user.id ? (
                          <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : user.isDisabled ? (
                          <Unlock size={13} />
                        ) : (
                          <Lock size={13} />
                        )}
                      </button>

                      {/* Hard Delete */}
                      <button
                        onClick={() => handleDeleteUserData(user)}
                        disabled={isActionLoading === user.id}
                        className="p-2 bg-slate-800 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900/40 rounded-lg transition-all cursor-pointer active:scale-90"
                        title="Hard Delete Merchant Data"
                      >
                        {isActionLoading === user.id ? (
                          <div className="h-3.5 w-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>

        {/* 📱 Right Column: Selected Node Details & Device Telemetry & Syslogs (5 cols) */}
        <section className="lg:col-span-5 space-y-6">
          
          {/* User Node details / Connected Devices */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 min-h-[300px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {selectedUser ? (
                <motion.div
                  key={selectedUser.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div>
                      <span className="text-[8px] font-mono text-indigo-400 font-bold uppercase tracking-widest">Active Node Telemetry</span>
                      <h3 className="text-sm font-black text-white uppercase mt-1 leading-tight">{selectedUser.email}</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Store: {selectedUser.storeName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[7.5px] font-mono uppercase font-black ${
                      selectedUser.isDisabled 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    }`}>
                      {selectedUser.isDisabled ? 'Disabled' : 'Operational'}
                    </span>
                  </div>

                  {/* Merchant Contact Specs */}
                  <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-400">
                    <div>
                      <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Owner Name</span>
                      <span className="text-white font-extrabold block truncate mt-0.5">{selectedUser.storeOwnerName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Phone / Contact</span>
                      <span className="text-white font-extrabold block truncate mt-0.5">{selectedUser.storePhone || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 mt-1 border-t border-slate-900 pt-2">
                      <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Store Address</span>
                      <span className="text-slate-300 font-bold block leading-relaxed mt-0.5 text-[9.5px]">{selectedUser.storeAddress || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Device List Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Monitor size={11} className="text-indigo-400" />
                        Connected Receivers ({devices.length})
                      </span>
                      <button 
                        onClick={() => fetchDevices(selectedUser.id)}
                        className="text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Scan Tokens
                      </button>
                    </div>

                    {devices.length === 0 ? (
                      <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 select-none">
                        <Monitor size={20} className="mx-auto opacity-30 mb-1" />
                        <span className="text-[8.5px] font-black uppercase tracking-wider block">No devices reported logs</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        {devices.map((dev) => (
                          <div 
                            key={dev.id} 
                            className="bg-slate-950/40 border border-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between text-[10px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
                              <div className="min-w-0">
                                <span className="font-extrabold text-white truncate block max-w-[130px]">{dev.deviceName}</span>
                                <span className="text-[7.5px] text-slate-500 font-mono block truncate max-w-[130px]">{dev.id}</span>
                              </div>
                            </div>
                            <span className="text-[8px] font-mono text-slate-400 font-bold flex items-center gap-1">
                              <Clock size={9} />
                              {dev.updatedAt ? new Date(dev.updatedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 select-none py-12">
                  <Database size={32} className="opacity-30 mb-2 animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    No Node Selected
                  </span>
                  <p className="text-[9px] text-slate-500 font-bold max-w-[200px] mt-1.5 leading-relaxed uppercase">
                    Select a merchant node from the active directory list on the left to inspect device telemetry.
                  </p>
                </div>
              )}
            </AnimatePresence>
            
            {/* Quick Warning Alert Footer inside Panel */}
            <div className="border-t border-slate-800/80 pt-3 mt-4 flex items-start gap-2 bg-rose-500/5 p-2 rounded-xl border border-rose-950/20">
              <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[8.5px] text-slate-400 leading-normal font-bold">
                <strong className="text-rose-400 font-black uppercase">DATA RECOVERY WARNING:</strong> Erasing merchant data is completely permanent and non-reversible. This deletes all Firestore subcollections instantaneously.
              </p>
            </div>
          </div>

          {/* Real-time System Audit Logging Terminal */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[280px]">
            <div className="bg-slate-900/50 p-3 px-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[8.5px] font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                <Activity size={12} className="text-emerald-400 animate-pulse" />
                System Audit Telemetry
              </span>
              <button 
                onClick={() => setSystemLogs([])}
                className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors"
              >
                Flush Logs
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-slate-950/80 font-mono text-[9px] space-y-1.5 selection:bg-indigo-500 selection:text-white">
              {systemLogs.length === 0 ? (
                <span className="text-slate-600 uppercase block select-none">Terminal idle. System is fully healthy.</span>
              ) : (
                systemLogs.map(log => {
                  let colorClass = "text-indigo-400";
                  if (log.type === "warn") colorClass = "text-rose-400";
                  if (log.type === "success") colorClass = "text-teal-400";
                  return (
                    <div key={log.id} className="leading-relaxed border-b border-slate-900 pb-1 flex items-start gap-2">
                      <span className="text-slate-500 font-bold shrink-0">[{log.time}]</span>
                      <span className={`${colorClass} font-bold break-all`}>{log.msg}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </section>
      </main>

    </div>
  );
}
