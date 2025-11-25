import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  userName?: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, userName, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🥗</span>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">NutriTrack AI</h1>
          </div>
          {userName && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline">Hi, {userName}</span>
              <button 
                onClick={onLogout}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 text-center text-gray-400 text-sm">
          <p>© 2025 NutriTrack AI. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
};