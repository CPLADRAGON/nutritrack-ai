import React, { useState, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { ProfileSetup } from './components/ProfileSetup';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, MealLog, UserProfile, WeightLog } from './types';
import { SheetService } from './services/sheetService';

type ViewState = 'LOGIN' | 'LOADING_DATA' | 'SETUP' | 'DASHBOARD';
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [state, setState] = useState<AppState>({
    currentUser: null,
    logs: [],
    weightHistory: []
  });
  
  const sheetServiceRef = useRef<SheetService | null>(null);

  const handleTokenExpired = useCallback(() => {
    alert('Your session has expired. Please sign in again.');
    setSyncStatus('error');
    setState({ currentUser: null, logs: [], weightHistory: [] });
    sheetServiceRef.current = null;
    setView('LOGIN');
  }, []);

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
    setState({ currentUser: null, logs: [], weightHistory: [] });
    setSyncStatus('idle');
    setLastSyncedAt(null);
    sheetServiceRef.current = null;
    setView('LOGIN');
  };

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
    </ErrorBoundary>
  );
};

export default App;