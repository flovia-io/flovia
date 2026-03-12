/**
 * SupabaseStorageTab - Displays Supabase storage buckets in the editor area
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import type { SupabaseBucket } from '../types/supabase.types';
import { SupabaseIcon } from './icons';

// Format storage data as readable text for AI context
function formatStorageAsContext(buckets: SupabaseBucket[]): string {
  if (buckets.length === 0) return '# Supabase Storage\n\nNo buckets found.';
  
  let content = `# Supabase Storage\n\nTotal buckets: ${buckets.length}\n\n`;
  content += '| Name | ID | Public | Created | File Size Limit | Allowed MIME Types |\n';
  content += '|------|-------|--------|---------|-----------------|--------------------|\n';
  
  for (const bucket of buckets) {
    const created = bucket.created_at ? new Date(bucket.created_at).toLocaleDateString() : 'N/A';
    const sizeLimit = bucket.file_size_limit ? `${(bucket.file_size_limit / 1024 / 1024).toFixed(1)} MB` : 'No limit';
    const mimeTypes = bucket.allowed_mime_types?.join(', ') || 'All types';
    content += `| ${bucket.name} | ${bucket.id} | ${bucket.public ? 'Yes' : 'No'} | ${created} | ${sizeLimit} | ${mimeTypes} |\n`;
  }
  
  return content;
}

export default function SupabaseStorageTab() {
  const { supabaseConfig, setTabData } = useWorkspace();
  const backend = useBackend();
  const [buckets, setBuckets] = useState<SupabaseBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStorage = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setError('Missing project URL or service role key. Add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await backend.supabaseGetStorage(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey
      );
      
      if (result.success) {
        setBuckets(result.buckets);
        // Update tab content so AI can access the data as context
        setTabData('supabase:storage', formatStorageAsContext(result.buckets));
      } else {
        setError(result.error || 'Failed to fetch storage buckets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, [supabaseConfig?.projectUrl, supabaseConfig?.serviceRoleKey]);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'No limit';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="sb-storage-tab">
      <div className="sb-storage-tab-header">
        <div className="sb-storage-tab-title">
          <SupabaseIcon size={20} />
          <h2>Storage</h2>
          <span className="sb-storage-count-badge">{buckets.length} buckets</span>
        </div>
        <button 
          className="sb-refresh-btn" 
          onClick={loadStorage} 
          disabled={loading}
          title="Refresh storage"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="sb-storage-loading">
          <div className="sb-spinner"></div>
          <span>Loading storage buckets...</span>
        </div>
      )}

      {error && (
        <div className="sb-storage-error">
          <span className="sb-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && buckets.length === 0 && (
        <div className="sb-storage-empty">
          <span>📁</span>
          <p>No storage buckets found</p>
        </div>
      )}

      {!loading && !error && buckets.length > 0 && (
        <div className="sb-storage-table-wrapper">
          <table className="sb-storage-table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Public</th>
                <th>Created</th>
                <th>Size Limit</th>
                <th>Allowed Types</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map(bucket => (
                <tr key={bucket.id}>
                  <td>
                    <div className="sb-bucket-cell">
                      <span className="sb-bucket-icon">🪣</span>
                      <div className="sb-bucket-details">
                        <span className="sb-bucket-name">{bucket.name}</span>
                        <span className="sb-bucket-id">{bucket.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {bucket.public ? (
                      <span className="sb-status-badge sb-status-public">🌐 Public</span>
                    ) : (
                      <span className="sb-status-badge sb-status-private">🔒 Private</span>
                    )}
                  </td>
                  <td className="sb-date-cell">
                    {bucket.created_at ? new Date(bucket.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>{formatSize(bucket.file_size_limit)}</td>
                  <td className="sb-mime-cell">
                    {bucket.allowed_mime_types?.length 
                      ? bucket.allowed_mime_types.slice(0, 3).join(', ') + (bucket.allowed_mime_types.length > 3 ? '...' : '')
                      : 'All types'
                    }
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
