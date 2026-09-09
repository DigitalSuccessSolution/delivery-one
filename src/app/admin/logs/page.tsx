'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
        <Activity className="h-6 w-6 text-blue-500" />
        Audit Logs
      </h1>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading audit logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="p-4 font-medium text-sm text-slate-400">Timestamp</th>
                  <th className="p-4 font-medium text-sm text-slate-400">User</th>
                  <th className="p-4 font-medium text-sm text-slate-400">Action</th>
                  <th className="p-4 font-medium text-sm text-slate-400">Target (Order ID)</th>
                  <th className="p-4 font-medium text-sm text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-medium text-white">{log.username}</td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded whitespace-nowrap">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-300">{log.targetId || '-'}</td>
                    <td className="p-4 text-sm text-slate-400 max-w-xs truncate" title={log.details}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">No logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
