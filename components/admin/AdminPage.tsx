import React, { useEffect, useState } from 'react';
import AdminLogin from './AdminLogin';
import Dashboard from './Dashboard';
import { Toaster } from '@/components/ui/sonner';
import { getSession } from '@/lib/auth-client';

const AdminPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('adminToken')
  );

  useEffect(() => {
    if (token) return;
    getSession().then(({ data }) => {
      const role = String(data?.user?.role ?? '');
      if (role === 'admin' || role === 'moderator') setToken('__session__');
    }).catch(() => {});
  }, [token]);

  const handleLogin = (tok: string) => {
    sessionStorage.setItem('adminToken', tok);
    setToken(tok);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!token ? (
        <AdminLogin onLogin={handleLogin} />
      ) : (
        <Dashboard token={token} onLogout={handleLogout} />
      )}
      <Toaster richColors />
    </div>
  );
};

export default AdminPage;
