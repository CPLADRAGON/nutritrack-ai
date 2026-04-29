import React, { useState, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { ProfileSetup } from './components/ProfileSetup';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, MealLog, UserProfile, WeightLog } from './types';
import { SheetService } from './services/sheetService';

type ViewState = 'LOGIN' | 'LOADING_DATA' | 'SETUP' | 'DASHBOARD';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [state, setState] = useState<AppState>({
    currentUser: null,
    logs: [],
    weightHistory: []
  });
  
  const sheetServiceRef = useRef<SheetService | null>(null);

  const handleTokenExpired = useCallback(() => {
    alert('Your session has expired. Please sign in again.');
    setState({ currentUser: null, logs: [], weightHistory: [] });
    sheetServiceRef.current = null;
    setView('LOGIN');
  }, []);

  const handleLoginSuccess = async (token: string) => {
    setView('LOADING_DATA');
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
        setView('DASHBOARD');
      } else {
        setView('SETUP');
      }
    } catch (error) {
      console.error("Failed to load data", error);
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
        await sheetServiceRef.current.saveUser(user);
      } catch (e) {
        console.error("Failed to save profile", e);
        alert("Warning: Could not save profile to cloud.");
      }
    }
  };

  const handleUpdateUser = async (user: UserProfile) => {
    setState(prev => ({ ...prev, currentUser: user }));
    if (sheetServiceRef.current) {
      try {
        await sheetServiceRef.current.saveUser(user);
      } catch (e) {
        console.error("Failed to save user update", e);
      }
    }
  };

  const handleUpdateLogs = async (logs: MealLog[]) => {
    setState(prev => ({ ...prev, logs }));
    if (sheetServiceRef.current) {
      try {
        await sheetServiceRef.current.saveLogs(logs);
      } catch (e) {
        console.error("Failed to save logs", e);
      }
    }
  };

  const handleUpdateWeight = async (history: WeightLog[]) => {
    setState(prev => ({ ...prev, weightHistory: history }));
    if (sheetServiceRef.current) {
      try {
        await sheetServiceRef.current.saveWeight(history);
      } catch (e) {
        console.error("Failed to save weight", e);
      }
    }
  };

  const handleLogout = () => {
    setState({ currentUser: null, logs: [], weightHistory: [] });
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
      <Layout userName={state.currentUser?.name} onLogout={handleLogout}>
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