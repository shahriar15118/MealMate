import { useEffect, useState } from 'react';
import { Tab, Member, Meal, Payment, SettingsConfig, ToastMessage } from './types';
import {
  syncSettings,
  syncMembers,
  syncMeals,
  syncPayments,
  auth,
  isLocalMode,
  setLocalMode
} from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AuthView from './components/AuthView';

import DashboardView from './components/DashboardView';
import CalendarViewTab from './components/CalendarViewTab';
import MembersLedgerTab from './components/MembersLedgerTab';
import MealManagementTab from './components/MealManagementTab';
import SettingsAdminTab from './components/SettingsAdminTab';
import SetupWizard from './components/SetupWizard';
import ToastContainer from './components/ToastContainer';

import {
  LayoutDashboard,
  Calendar,
  UsersRound,
  UtensilsCrossed,
  Sliders,
  Sparkles,
  Plus,
  Loader2,
  WifiOff,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Dashboard);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(() => isLocalMode());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [syncTimeout, setSyncTimeout] = useState(false);

  // Authenticated listener
  useEffect(() => {
    if (offlineMode) {
      setUser({
        uid: 'u1',
        email: 'shahriarrahama@gmail.com',
        displayName: 'Shahriar Rahama'
      });
      setAuthLoading(false);
      setLoading(false);
      return;
    }
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => {
      unsubAuth();
    };
  }, [offlineMode]);

  // Firestore Sync States
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<SettingsConfig | null>(null);

  // Determine current active roommate
  const currentMember = user ? members.find(m => m.uid === user.uid || m.email?.toLowerCase() === user.email?.toLowerCase()) : null;

  // App Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show Seeding Wizard modal
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Fast Meal Modal for Mobile FAB
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Utility toast dispatcher
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString() + Math.random().toString().substring(2, 5);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Sync with database on boot when authenticated or offline
  useEffect(() => {
    if (!offlineMode && !user) {
      setSettings(null);
      setMembers([]);
      setMeals([]);
      setPayments([]);
      setLoading(true);
      return;
    }

    let unsubSettings: (() => void) | null = null;
    let unsubMembers: (() => void) | null = null;
    let unsubMeals: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;

    const startSync = () => {
      try {
        unsubSettings = syncSettings(
          (config) => {
            setSettings(config);
            setConnectionError(null);
            setLoading(false);
          },
          (err) => {
            console.warn("Settings sync warning:", err);
            setConnectionError(err.message);
          }
        );

        unsubMembers = syncMembers(
          (memberList) => {
            setMembers(memberList);
            setConnectionError(null);
            // Check if seeding is needed
            if (memberList.length === 0) {
              setShowSetupWizard(true);
            } else {
              setShowSetupWizard(false);
            }
          },
          (err) => {
            console.warn("Members sync warning:", err);
            setConnectionError(err.message);
          }
        );

        unsubMeals = syncMeals(
          (mealList) => {
            setMeals(mealList);
          },
          (err) => {
            console.warn("Meals sync warning:", err);
          }
        );

        unsubPayments = syncPayments(
          (paymentList) => {
            setPayments(paymentList);
          },
          (err) => {
            console.warn("Payments sync warning:", err);
          }
        );
      } catch (err: any) {
        console.error("Master initialization sync error: ", err);
        setConnectionError(err?.message || String(err));
      }
    };

    startSync();

    // Default loader timer
    const checkTimer = setTimeout(() => {
      if (settings) {
        setLoading(false);
      }
    }, 1200);

    // 4.5 seconds timeout triggers troubleshoot UI
    const timeoutTimer = setTimeout(() => {
      setSyncTimeout(true);
    }, 4500);

    return () => {
      if (unsubSettings) unsubSettings();
      if (unsubMembers) unsubMembers();
      if (unsubMeals) unsubMeals();
      if (unsubPayments) unsubPayments();
      clearTimeout(checkTimer);
      clearTimeout(timeoutTimer);
    };
  }, [offlineMode, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 gap-3.5 select-none">
        <div className="relative flex items-center justify-center animate-pulse">
          <Loader2 className="w-8 h-8 text-[#6C63FF] animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <AuthView showToast={showToast} />
      </>
    );
  }

  if (loading || !settings) {
    if (syncTimeout || connectionError) {
      return (
        <div className="min-h-screen bg-[#0F1117] text-[#E8E9F3] flex items-center justify-center p-4 sm:p-6 select-none font-sans">
          <div className="w-full max-w-lg bg-[#1A1D2E] rounded-3xl border border-[#2D3142]/80 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
            
            <div className="flex gap-4">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-xl">
                <WifiOff className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-white tracking-tight">Firebase Cloud Handshake Delayed</h2>
                <span className="block text-[10px] text-gray-500 font-mono tracking-wider uppercase">MealMate Ledger Hub</span>
              </div>
            </div>

            <div className="space-y-3 bg-[#0F1117] p-4 rounded-2xl border border-[#2D3142]/60 text-xs text-left">
              <span className="block font-bold text-[#E8E9F3] mb-1">Diagnostic Context & Common Causes:</span>
              <p className="text-gray-400 leading-relaxed font-mono text-[11px] break-all">
                {connectionError || "Connection request timed out. Firestore database taking too long to hand-shake."}
              </p>
              <div className="pt-2 border-t border-[#2D3142]/40 text-[#00D4AA] font-normal leading-relaxed font-mono text-[10px]">
                Note: Firestore requires manual creation. Go to Firebase Console &gt; Build &gt; Firestore Database &gt; "Create Database" in test mode or deployment rules.
              </div>
            </div>

            <div className="space-y-2 text-xs text-left bg-gray-900/40 p-4 rounded-2xl border border-[#2D3142]/30">
              <span className="block font-black text-white">How to fix & configure:</span>
              <ul className="list-disc list-inside space-y-1 text-gray-400 leading-relaxed">
                <li>Create Firestore database under project <span className="font-semibold text-white">mealmate15</span></li>
                <li>Set rules to <span className="text-[#00D4AA] font-mono">Test Mode</span> or deploy custom rules</li>
                <li>If the container sandbox is run completely offline, click the demo mode below to proceed immediately!</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSyncTimeout(false);
                  setConnectionError(null);
                  window.location.reload();
                }}
                className="flex-1 py-3 px-4 bg-[#20243E] hover:bg-[#2c3154] text-white font-bold text-xs rounded-xl border border-[#2D3142] transition active:scale-95 cursor-pointer text-center"
              >
                🔄 Try Reconnecting
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalMode(true);
                  setOfflineMode(true);
                  setSettings({
                    mealCost: 65,
                    lunchCancelDeadline: '09:00',
                    dinnerCancelDeadline: '17:00'
                  });
                  setSyncTimeout(false);
                  setConnectionError(null);
                  setLoading(false);
                }}
                className="flex-1 py-3 px-4 bg-[#6C63FF] hover:bg-[#5b54e7] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#6C63FF]/20 transition active:scale-95 cursor-pointer text-center"
              >
                🚀 Sandbox Local Mode
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 gap-3.5 select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#6C63FF]/10 border border-[#6C63FF]/30 flex items-center justify-center text-[#6C63FF] animate-pulse">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <Loader2 className="w-16 h-16 text-[#00D4AA] animate-spin absolute -right-1 -top-1" />
        </div>
        <div className="space-y-1 text-center">
          <span className="text-sm font-sans font-bold text-[#E8E9F3] tracking-wide">Connecting to MealMate Firestore Ledger</span>
          <p className="text-[10px] text-gray-500 font-mono">Synchronizing household parameters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#E8E9F3] flex flex-col pb-20 md:pb-0 overflow-x-hidden font-sans">
      
      {/* Toast Manager notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Setup Seeding wizard overlay */}
      {showSetupWizard && (
        <SetupWizard 
          onComplete={() => setShowSetupWizard(false)} 
          showToast={showToast} 
        />
      )}

      {/* Main Framework Layout Container */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        
        {/* Left Side Sidebar - Only Visible on Desktop layouts (md:flex) */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[#1A1D2E] border-r border-[#2D3142]/80 p-6 space-y-8 select-none">
          {/* Visual logo header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#6C63FF]/15 text-[#6C63FF] shadow-inner">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="block font-sans text-lg font-black text-white tracking-tight">MealMate</span>
              <p className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">Bachelor Mess</p>
            </div>
          </div>

          {/* Desktop Nav Actions List */}
          <nav className="flex-1 flex flex-col gap-2">
            {[
              { id: Tab.Dashboard, icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
              { id: Tab.Calendar, icon: <Calendar className="w-4 h-4" />, label: 'Calendar Grid' },
              { id: Tab.Members, icon: <UsersRound className="w-4 h-4" />, label: 'Ledger Balances' },
              { id: Tab.Meals, icon: <UtensilsCrossed className="w-4 h-4" />, label: 'Meal Scheduler' },
              { id: Tab.Settings, icon: <Sliders className="w-4 h-4" />, label: 'Mess Settings' },
            ].map((link) => (
              <button
                key={link.id}
                id={`desktop-nav-lnk-${link.id}`}
                type="button"
                onClick={() => setActiveTab(link.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer ${
                  activeTab === link.id
                    ? 'bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/20'
                    : 'text-[#6B7280] hover:text-white hover:bg-[#20243E]'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer info */}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#2D3142]/40">
            <button
              type="button"
              onClick={() => {
                if (offlineMode) {
                  setLocalMode(false);
                  window.location.reload();
                } else {
                  signOut(auth);
                }
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold font-sans tracking-wide transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Log Out</span>
            </button>
            <div className="flex items-center gap-2 text-[10px] text-gray-550 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
              <span>App Version 2.1.0 Cloud</span>
            </div>
          </div>
        </aside>

        {/* Right Main content view container */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-full overflow-hidden">
          
          {/* Top Banner (Only on Mobile screens to show logo header) */}
          <header className="flex md:hidden items-center justify-between p-4 bg-[#1A1D2E] rounded-xl border border-[#2D3142]/65 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-[#6C63FF]/15 text-[#6C63FF]">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="font-sans font-black text-white text-base tracking-tight">MealMate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (offlineMode) {
                    setLocalMode(false);
                    window.location.reload();
                  } else {
                    signOut(auth);
                  }
                }}
                className="p-2 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition"
                title="Log Out User"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold font-mono uppercase bg-[#00D4AA]/10 text-[#00D4AA] animate-pulse">
                Spark
              </span>
            </div>
          </header>

          {/* Active Tab View Panel (Enclosed in motion transitions) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === Tab.Dashboard && (
                <DashboardView 
                  members={members} 
                  meals={meals} 
                  payments={payments} 
                  settings={settings} 
                  showToast={showToast} 
                  currentMember={currentMember}
                />
              )}
              {activeTab === Tab.Calendar && (
                <CalendarViewTab 
                  members={members} 
                  meals={meals} 
                  settings={settings} 
                  showToast={showToast} 
                />
              )}
              {activeTab === Tab.Members && (
                <MembersLedgerTab 
                  members={members} 
                  meals={meals} 
                  payments={payments} 
                  settings={settings} 
                  showToast={showToast} 
                  currentMember={currentMember}
                />
              )}
              {activeTab === Tab.Meals && (
                <MealManagementTab 
                  members={members} 
                  meals={meals} 
                  settings={settings} 
                  showToast={showToast} 
                />
              )}
              {activeTab === Tab.Settings && (
                <SettingsAdminTab 
                  members={members} 
                  meals={meals} 
                  payments={payments} 
                  settings={settings} 
                  showToast={showToast} 
                />
              )}
            </motion.div>
          </AnimatePresence>

        </main>
      </div>

      {/* Floating Action Button (FAB) on Mobile screens (Hidden on desktop) */}
      <div className="fixed bottom-24 right-4 z-40 md:hidden">
        <button
          id="mobile-quick-fab"
          type="button"
          onClick={() => {
            setActiveTab(Tab.Meals);
            showToast('info', 'Switched to Meal Scheduler for quick allocations.');
          }}
          className="p-4 bg-[#6C63FF] hover:bg-[#5b54e7] text-white rounded-full shadow-2xl transition-all flex items-center justify-center active:scale-95"
          title="Add or update custom schedules"
        >
          <Plus className="w-6 h-6 shrink-0" />
        </button>
      </div>

      {/* Bottom Floating Navigation bar - Only Visible on Mobile screens (md:hidden) */}
      <nav id="mobile-bottom-tabs" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1A1D2E] border-t border-[#2D3142] py-2 px-4 flex justify-around items-center select-none shadow-[0_-5px_15px_rgba(0,0,0,0.4)]">
        {[
          { id: Tab.Dashboard, icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dash' },
          { id: Tab.Calendar, icon: <Calendar className="w-5 h-5" />, label: 'Calendar' },
          { id: Tab.Members, icon: <UsersRound className="w-5 h-5" />, label: 'Ledger' },
          { id: Tab.Meals, icon: <UtensilsCrossed className="w-5 h-5" />, label: 'Roster' },
          { id: Tab.Settings, icon: <Sliders className="w-5 h-5" />, label: 'Admin' },
        ].map((item) => (
          <button
            key={item.id}
            id={`mobile-tab-btn-${item.id}`}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition ${
              activeTab === item.id ? 'text-[#6C63FF]' : 'text-[#6B7280]'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-bold font-sans tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
