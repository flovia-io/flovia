/**
 * SupabaseUsersTab - Displays Supabase users in the editor area
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { SupabaseUser } from '../types/supabase.types';
import { SupabaseIcon } from './icons';

// Format users data as readable text for AI context
function formatUsersAsContext(users: SupabaseUser[]): string {
  if (users.length === 0) return '# Supabase Users\n\nNo users found.';
  
  let content = `# Supabase Users\n\nTotal users: ${users.length}\n\n`;
  content += '| Email | ID | Created | Last Sign In | Verified | Metadata |\n';
  content += '|-------|----|---------|--------------|-----------|---------|\n';
  
  for (const user of users) {
    const email = user.email || user.phone || 'N/A';
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never';
    const verified = user.email_confirmed_at ? 'Yes' : 'No';
    const metadata = JSON.stringify(user.user_metadata || {});
    content += `| ${email} | ${user.id} | ${created} | ${lastSignIn} | ${verified} | ${metadata} |\n`;
  }
  
  return content;
}

export default function SupabaseUsersTab() {
  const { supabaseConfig, setTabData } = useWorkspace();
  const backend = useBackend();
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setError('Missing project URL or service role key. Add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await backend.supabaseGetUsers(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey
      );
      
      if (result.success) {
        setUsers(result.users);
        // Update tab content so AI can access the data as context
        setTabData('supabase:users', formatUsersAsContext(result.users));
      } else {
        setError(result.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [supabaseConfig?.projectUrl, supabaseConfig?.serviceRoleKey]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="sb-users-tab">
      <div className="sb-users-tab-header">
        <div className="sb-users-tab-title">
          <SupabaseIcon size={20} />
          <h2>Users</h2>
          <span className="sb-users-count-badge">{users.length}</span>
        </div>
        <button 
          className="sb-refresh-btn" 
          onClick={loadUsers} 
          disabled={loading}
          title="Refresh users"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="sb-users-loading">
          <div className="sb-spinner"></div>
          <span>Loading users...</span>
        </div>
      )}

      {error && (
        <div className="sb-users-error">
          <span className="sb-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="sb-users-empty">
          <span>👥</span>
          <p>No users found</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="sb-users-table-wrapper">
          <table className="sb-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Created</th>
                <th>Last Sign In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="sb-user-cell">
                      <div className="sb-user-avatar">
                        {(user.email?.[0] || user.phone?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="sb-user-details">
                        <span className="sb-user-email">{user.email || user.phone || 'No email'}</span>
                        <span className="sb-user-id">{user.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </td>
                  <td className="sb-date-cell">{formatDate(user.created_at)}</td>
                  <td className="sb-date-cell">{formatDate(user.last_sign_in_at)}</td>
                  <td>
                    {user.email_confirmed_at ? (
                      <span className="sb-status-badge sb-status-verified">✓ Verified</span>
                    ) : (
                      <span className="sb-status-badge sb-status-pending">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
