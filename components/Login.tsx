import React, { useEffect, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';

declare global {
  interface Window {
    google: any;
  }
}

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const origin = window.location.origin;

  useEffect(() => {
    // Check if user configured client ID
    // We check for empty string, null, undefined, or the placeholder text
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.trim() === '' || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      setError("Configuration Missing");
    }
  }, []);

  const handleGoogleLogin = () => {
    if (error) return;

    if (!GOOGLE_CLIENT_ID) {
      setError("Configuration Missing");
      return;
    }

    if (!window.google) {
      setError("Google scripts not loaded. Check internet connection.");
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) {
            onLoginSuccess(response.access_token);
          } else {
            setError("Failed to sign in. Please try again.");
          }
        },
      });

      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      setError("Initialization Error: Client ID invalid.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-['Inter']">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-xl shadow-emerald-100">
            <span className="text-5xl">🥗</span>
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          NutriTrack AI
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Your personal AI nutritionist, powered by Gemini
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-lg py-8 px-4 shadow-xl border border-white/50 sm:rounded-2xl sm:px-10">

          <div className="space-y-6">
            {error === "Configuration Missing" ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-sm shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="font-bold">Setup Required</p>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-amber-800">
                  <li>Create project in <b>Google Cloud Console</b>.</li>
                  <li>Create <b>OAuth Client ID</b> (Web App).</li>
                  <li>Add Origin to <b>Authorized Origins</b>.</li>
                  <li>Add Client ID to <b>GitHub Secrets</b> or <code>.env</code>.</li>
                </ol>
              </div>
            ) : error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                onClick={handleGoogleLogin}
                disabled={!!error}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm border-gray-200 transition-all ${error ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <img className={`h-5 w-5 ${error ? 'grayscale opacity-50' : ''}`} src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
                </span>
                Sign in with Google
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-400 bg-opacity-50">Securely stored in your Drive</span>
              </div>
            </div>

            {/* Troubleshooting Helper */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={(e) => {
                  const el = e.currentTarget.nextElementSibling;
                  if (el) el.classList.toggle('hidden');
                }}
                className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
              >
                <span>Troubleshooting</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              <div className="hidden space-y-4 mt-4 animate-fadeIn">
                {/* Error 403 Help */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-1">Error 403: access_denied</p>
                  <p className="text-xs text-gray-500">
                    Project is in "Testing" mode?
                  </p>
                  <ol className="list-decimal pl-4 text-xs text-gray-500 mt-1">
                    <li>Go to <b>OAuth consent screen</b>.</li>
                    <li>Add your email to <b>Test users</b>.</li>
                  </ol>
                </div>

                {/* Error 400 Help */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-1">Error 400: redirect_uri_mismatch</p>
                  <p className="text-xs text-gray-500 mb-1">
                    Copy this URL to "Authorized JavaScript origins":
                  </p>
                  <div className="relative group">
                    <code className="block w-full bg-white border border-gray-200 p-2 rounded text-xs text-gray-600 font-mono break-all select-all cursor-text shadow-inner">
                      {origin}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};