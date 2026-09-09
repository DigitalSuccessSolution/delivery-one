'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Users } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, userRole: role })
      });
      const data = await res.json();
      
      if (data.success) {
        setSuccess('User created successfully');
        setUsername('');
        setPassword('');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
        <Users className="h-6 w-6 text-blue-500" />
        User Management
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <UserPlus className="h-5 w-5" /> Add New User
            </h2>
            
            {error && <div className="bg-red-500/10 text-red-400 p-3 rounded text-sm mb-4 border border-red-500/20">{error}</div>}
            {success && <div className="bg-green-500/10 text-green-400 p-3 rounded text-sm mb-4 border border-green-500/20">{success}</div>}
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white outline-none focus:border-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white outline-none focus:border-blue-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white outline-none focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
              >
                Create User
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 font-medium text-white">
              Existing Users
            </div>
            {loading ? (
              <div className="p-6 text-center text-slate-400">Loading users...</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="p-4 font-medium text-sm text-slate-400">Username</th>
                    <th className="p-4 font-medium text-sm text-slate-400">Role</th>
                    <th className="p-4 font-medium text-sm text-slate-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4 font-medium text-white">{user.username}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
