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

  useEffect(() => {
    // Check if user configured client ID
    if (GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      setError("Please configure your Google Client ID in config.ts");
    }
  }, []);

  const handleGoogleLogin = () => {
    if (!window.google) {
      setError("Google scripts not loaded. Check internet connection.");
      return;
    }

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
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <span className="text-4xl">🥗</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          NutriTrack AI
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to access your nutrition plan anywhere
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          <div className="space-y-4">
             {error && (
               <div className="bg-red-50 text-red-700 p-3 rounded text-sm text-center">
                 {error}
               </div>
             )}

             <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <img className="h-5 w-5 mr-3" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
                Sign in with Google
             </button>

             <p className="text-xs text-center text-gray-500 mt-4">
               Your data will be stored securely in a Google Sheet in your personal Drive.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};