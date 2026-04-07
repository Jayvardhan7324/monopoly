import React, { useState } from 'react';
import AdminLogin from './AdminLogin';
import Dashboard from './Dashboard';
import { Toaster } from '@/components/ui/sonner';

const AdminPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('adminToken')
  );

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
