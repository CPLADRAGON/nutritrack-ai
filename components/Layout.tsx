import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  userName?: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, userName, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Inter']">
      <header className="bg-white/90 backdrop-blur-md fixed top-0 w-full z-50 border-b border-slate-100 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl filter drop-shadow-sm">🥗</span>
            <h1 className="text-xl font-extrabold text-slate-950 tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">NutriTrack AI</h1>
          </div>
          {userName && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs text-slate-400 font-medium">Signed in as</span>
                <span className="text-sm text-slate-700 font-semibold">{userName}</span>
              </div>
              <button
                onClick={onLogout}
                className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-full font-bold transition-colors border border-red-100"
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Added pt-20 to account for fixed header height */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24 animate-fadeIn">
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