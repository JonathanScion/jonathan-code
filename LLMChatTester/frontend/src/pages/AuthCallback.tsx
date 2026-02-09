import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('Authentication failed. Please try again.');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
      return;
    }

    if (token) {
      // Store the token
      localStorage.setItem('token', token);
      // Redirect to home - force a full reload to pick up the new token
      window.location.href = '/';
    } else {
      setError('No authentication token received.');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    }
  }, [params, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <div className="text-gray-500">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <div className="text-gray-400">Completing sign in...</div>
      </div>
    </div>
  );
}
