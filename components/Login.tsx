import React, { useEffect, useState, useRef } from 'react';
import { AppLogo } from './Icons';
import { getStoredToken, isTokenValid, refreshTokenSilently } from '../utils/tokenStorage';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const restoreSession = async () => {
      // 1. Access token from this page load is still valid
      if (isTokenValid()) {
        onLoginSuccess(getStoredToken()!.access_token);
        return;
      }

      // 2. Ask our backend for a fresh access token. The session cookie and
      // refresh token live server-side, so this is a normal fetch — no popup
      // and no user gesture required.
      const token = await refreshTokenSilently();
      if (token) {
        onLoginSuccess(token);
        return;
      }

      // 3. No session — surface an OAuth callback error if there was one
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'error') {
        setError('Google sign-in failed. Please try again.');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (getStoredToken()) {
        setError('Session expired. Sign in again to continue.');
      }
      setIsRestoring(false);
    };

    restoreSession();
  }, [onLoginSuccess]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  if (isRestoring) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-primary text-xl flex-col gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>Restoring session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-['Inter']">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-xl shadow-emerald-100">
            <AppLogo className="w-14 h-14" />
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
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                onClick={handleGoogleLogin}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm border-gray-200 transition-all hover:shadow-md"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <img className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
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

            <p className="text-center text-xs text-gray-400">
              Sign-in is handled on our server. Your meals stay in your own Google Drive.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
