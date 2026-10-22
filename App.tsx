import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ProfileSetup } from './components/ProfileSetup';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, MealLog, UserProfile, WeightLog } from './types';
import { SheetService } from './services/sheetService';
import { isTokenExpiringSoon, logoutSession, refreshTokenSilently } from './utils/tokenStorage';

type ViewState = 'LOGIN' | 'LOADING_DATA' | 'SETUP' | 'DASHBOARD';
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [reconnectNeeded, setReconnectNeeded] = useState(false);
  const [state, setState] = useState<AppState>({
    currentUser: null,
    logs: [],
    weightHistory: []
  });
  
  const sheetServiceRef = useRef<SheetService | null>(null);

  // The backend holds the refresh token, so a new access token can be fetched
  // with a plain request. Only fall back to the manual overlay if that fails.
  const handleTokenExpired = useCallback(async () => {
    const newToken = await refreshTokenSilently();
    if (newToken && sheetServiceRef.current) {
      sheetServiceRef.current.updateToken(newToken);
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('error');
    setReconnectNeeded(true);
  }, []);

  const handleReconnect = async () => {
    const newToken = await refreshTokenSilently();
    if (newToken && sheetServiceRef.current) {
      sheetServiceRef.current.updateToken(newToken);
      setReconnectNeeded(false);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    }
  };

  const handleLoginSuccess = async (token: string) => {
    setView('LOADING_DATA');
    setSyncStatus('syncing');
    sheetServiceRef.current = new SheetService(token, handleTokenExpired);
    
    try {
      await sheetServiceRef.current.init();
      const data = await sheetServiceRef.current.loadData();
      
      if (data.user) {
        setState({
          currentUser: data.user,
          logs: data.logs,
          weightHistory: data.weight
        });
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
        setView('DASHBOARD');
      } else {
        setSyncStatus('idle');
        setView('SETUP');
      }
    } catch (error) {
      console.error("Failed to load data", error);
      setSyncStatus('error');
      alert("Failed to access Google Sheets. Please check permissions and try again.");
      setView('LOGIN');
    }
  };

  const handleProfileComplete = async (user: UserProfile) => {
    // Optimistic Update
    setState(prev => ({ ...prev, currentUser: user }));
    setView('DASHBOARD'); // Go to dashboard immediately
    
    // Async Save
    if (sheetServiceRef.current) {
      try {
        setSyncStatus('syncing');
        await sheetServiceRef.current.saveUser(user);
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
      } catch (e) {
        console.error("Failed to save profile", e);
        setSyncStatus('error');
        alert("Warning: Could not save profile to cloud.");
      }
    }
  };

  const handleUpdateUser = async (user: UserProfile) => {
    setState(prev => ({ ...prev, currentUser: user }));
    if (sheetServiceRef.current) {
      try {
        setSyncStatus('syncing');
        await sheetServiceRef.current.saveUser(user);
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
      } catch (e) {
        console.error("Failed to save user update", e);
        setSyncStatus('error');
      }
    }
  };

  const handleUpdateLogs = async (logs: MealLog[]) => {
    setState(prev => ({ ...prev, logs }));
    if (sheetServiceRef.current) {
      try {
        setSyncStatus('syncing');
        await sheetServiceRef.current.saveLogs(logs);
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
      } catch (e) {
        console.error("Failed to save logs", e);
        setSyncStatus('error');
      }
    }
  };

  const handleUpdateWeight = async (history: WeightLog[]) => {
    setState(prev => ({ ...prev, weightHistory: history }));
    if (sheetServiceRef.current) {
      try {
        setSyncStatus('syncing');
        await sheetServiceRef.current.saveWeight(history);
        setLastSyncedAt(new Date());
        setSyncStatus('synced');
      } catch (e) {
        console.error("Failed to save weight", e);
        setSyncStatus('error');
      }
    }
  };

  const handleLogout = () => {
    void logoutSession();
    setReconnectNeeded(false);
    setState({ currentUser: null, logs: [], weightHistory: [] });
    setSyncStatus('idle');
    setLastSyncedAt(null);
    sheetServiceRef.current = null;
    setView('LOGIN');
  };

  // Refresh before the 1-hour token expires so saves never fail mid-session.
  useEffect(() => {
    if (view !== 'DASHBOARD' && view !== 'SETUP') return;

    const interval = setInterval(async () => {
      if (!isTokenExpiringSoon(10 * 60_000)) return;
      const newToken = await refreshTokenSilently();
      if (newToken && sheetServiceRef.current) {
        sheetServiceRef.current.updateToken(newToken);
      }
    }, 5 * 60_000);

    return () => clearInterval(interval);
  }, [view]);

  if (view === 'LOADING_DATA') {
     return <div className="h-screen w-screen flex items-center justify-center text-primary text-xl flex-col gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>Syncing with Google Drive...</span>
     </div>
  }

  if (view === 'LOGIN') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <ErrorBoundary>
      <Layout
        userName={state.currentUser?.name}
        user={state.currentUser}
        logs={state.logs}
        weightHistory={state.weightHistory}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onLogout={handleLogout}
      >
        {view === 'SETUP' ? (
          <ProfileSetup 
            onComplete={handleProfileComplete} 
            onCancel={() => setView('LOGIN')}
          />
        ) : (
          state.currentUser && (
            <Dashboard 
               user={state.currentUser}
               logs={state.logs}
               weightHistory={state.weightHistory}
               onUpdateUser={handleUpdateUser}
               onUpdateLogs={handleUpdateLogs}
               onUpdateWeight={handleUpdateWeight}
            />
          )
        )}
      </Layout>

      {reconnectNeeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Session expired</h2>
            <p className="mt-1 text-sm text-slate-600">
              Reconnect to keep syncing your meals to Google Drive. Your current changes stay on screen and will sync once you reconnect.
            </p>
            <button
              onClick={handleReconnect}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Reconnect
            </button>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
            >
              Sign out instead
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default App;