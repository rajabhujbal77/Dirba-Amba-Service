import React, { useState } from 'react';
import { authApi } from '../utils/api';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface LoginPageProps {
  onLogin: (role: 'owner' | 'booking_clerk' | 'depot_manager') => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'booking_clerk' | 'depot_manager'>('owner');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');
  const [initMessage, setInitMessage] = useState('');

  const handleInitialize = async () => {
    setIsInitializing(true);
    setInitMessage('');
    setError('');
    
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-9db23d94/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.credentials) {
          setInitMessage(`System initialized! You can now login with:\nEmail: ${data.credentials.email}\nPassword: ${data.credentials.password}`);
          setUsername(data.credentials.email);
        } else {
          setInitMessage('System already initialized. Use existing credentials to login.');
        }
      } else {
        setError('Failed to initialize system. Check console for details.');
      }
    } catch (err: any) {
      console.error('Initialize error:', err);
      setError('Failed to initialize system. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await authApi.signIn(username, password);
      onLogin(selectedRole);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4">
              <span className="text-3xl">🥭</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mango Express</h1>
            <p className="text-gray-600">Seasonal Transport Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Login As
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="owner">Owner</option>
                <option value="booking_clerk">Booking Clerk</option>
                <option value="depot_manager">Depot Manager</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {initMessage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 whitespace-pre-line">
              {initMessage}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            <button
              type="button"
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isInitializing ? 'Initializing...' : 'Initialize System (First Time Setup)'}
            </button>
            
            <p className="text-xs text-gray-500 text-center">
              Click above if this is your first time using the system. This will create an admin account and default data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}