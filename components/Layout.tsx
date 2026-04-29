import React, { useMemo, useState } from 'react';
import { MealLog, UserProfile, WeightLog } from '../types';
import { AppLogo, ChartIcon, LogoutIcon, ScaleIcon, UserIcon } from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  userName?: string;
  user?: UserProfile | null;
  logs?: MealLog[];
  weightHistory?: WeightLog[];
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt?: Date | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, userName, user, logs = [], weightHistory = [], syncStatus = 'idle', lastSyncedAt = null, onLogout }) => {
  const [showProfile, setShowProfile] = useState(false);
  const profileStats = useMemo(() => {
    const loggedDays = new Set(logs.map(log => log.date)).size;
    const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : user?.weight;
    const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
    const averageCalories = loggedDays > 0 ? Math.round(totalCalories / loggedDays) : 0;
    return { loggedDays, latestWeight, averageCalories };
  }, [logs, user?.weight, weightHistory]);

  const syncLabel = useMemo(() => {
    if (syncStatus === 'syncing') return 'Syncing…';
    if (syncStatus === 'error') return 'Sync failed';
    if (syncStatus === 'synced') {
      if (!lastSyncedAt) return 'Synced';
      const diffMs = Date.now() - lastSyncedAt.getTime();
      const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
      if (diffMinutes < 1) return 'Synced just now';
      if (diffMinutes === 1) return 'Synced 1 min ago';
      return `Synced ${diffMinutes} mins ago`;
    }
    return 'Not synced yet';
  }, [lastSyncedAt, syncStatus]);

  const syncClass = syncStatus === 'error'
    ? 'bg-red-50 text-red-600 border-red-100'
    : syncStatus === 'syncing'
      ? 'bg-blue-50 text-blue-600 border-blue-100'
      : syncStatus === 'synced'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : 'bg-slate-50 text-slate-500 border-slate-200';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Inter']">
      <header className="bg-white/90 backdrop-blur-md fixed top-0 w-full z-50 border-b border-slate-100 transition-all duration-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AppLogo className="w-9 h-9 drop-shadow-sm" />
            <h1 className="text-xl font-extrabold text-slate-950 tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">NutriTrack AI</h1>
          </div>
          {userName && (
            <div className="relative flex items-center gap-3">
              <div className={`hidden md:inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${syncClass}`} title={syncLabel}>
                <span className={`h-2 w-2 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                {syncLabel}
              </div>
              <button
                onClick={() => setShowProfile(prev => !prev)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition hover:bg-slate-50"
                aria-label="Open profile summary"
                aria-expanded={showProfile}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UserIcon className="w-4 h-4" />
                </span>
                <span className="hidden sm:flex flex-col items-start mr-1">
                  <span className="text-[11px] text-slate-400 font-semibold leading-none">Profile</span>
                  <span className="text-sm text-slate-700 font-bold leading-tight">{userName}</span>
                </span>
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 sm:px-4 py-2 rounded-full font-bold transition-colors border border-red-100"
              >
                <LogoutIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Exit</span>
              </button>

              {showProfile && user && (
                <div className="absolute right-0 top-full mt-3 w-[min(calc(100vw-2rem),24rem)] rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl shadow-slate-200/60">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Nutrition Profile</p>
                      <h2 className="mt-1 text-lg font-extrabold text-slate-950">{user.name}</h2>
                      <p className="text-sm text-slate-500">{user.goal.replace('_', ' ')} · {user.activityLevel.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <ChartIcon className="w-4 h-4 text-emerald-600" />
                      <p className="mt-2 text-lg font-extrabold text-slate-950">{logs.length}</p>
                      <p className="text-xs font-semibold text-slate-500">Meals</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <ScaleIcon className="w-4 h-4 text-blue-600" />
                      <p className="mt-2 text-lg font-extrabold text-slate-950">{profileStats.latestWeight ?? '-'}<span className="text-xs text-slate-500">kg</span></p>
                      <p className="text-xs font-semibold text-slate-500">Weight</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <ChartIcon className="w-4 h-4 text-purple-600" />
                      <p className="mt-2 text-lg font-extrabold text-slate-950">{profileStats.loggedDays}</p>
                      <p className="text-xs font-semibold text-slate-500">Days</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-400">Daily target</p>
                        <p className="font-extrabold text-slate-950">{user.targetCalories} kcal</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-400">Avg/day</p>
                        <p className="font-extrabold text-slate-950">{profileStats.averageCalories} kcal</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-400">Height</p>
                        <p className="font-extrabold text-slate-950">{user.height} cm</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-400">TDEE</p>
                        <p className="font-extrabold text-slate-950">{user.tdee} kcal</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {/* Added pt-20 to account for fixed header height */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-[calc(6rem+env(safe-area-inset-top))] animate-fadeIn">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-100 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">© 2025 NutriTrack AI. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
};