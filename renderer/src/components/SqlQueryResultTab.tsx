/**
 * SqlQueryResultTab - Displays SQL query results in a table view
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import { DatabaseIcon, PlayIcon } from './icons';
import type { SqlQueryResult } from '../types/supabase.types';

interface SqlQueryResultTabProps {
  queryId: string;
}

// Format query results as readable text for AI context
function formatResultsAsContext(query: string, result: SqlQueryResult): string {
  if (!result.success) {
    return `# SQL Query Result\n\n**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n**Error:** ${result.error}`;
  }
  
  if (result.data.length === 0) {
    return `# SQL Query Result\n\n**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n**Result:** No rows returned.`;
  }
  
  let content = `# SQL Query Result\n\n**Query:**\n\`\`\`sql\n${query}\n\`\`\`\n\n`;
  content += `**Rows:** ${result.rowCount} | **Execution Time:** ${result.executionTime}ms\n\n`;
  
  // Build markdown table
  content += '| ' + result.columns.join(' | ') + ' |\n';
  content += '|' + result.columns.map(() => '---').join('|') + '|\n';
  
  for (const row of result.data.slice(0, 100)) { // Limit to 100 rows for context
    const values = result.columns.map(col => {
      const val = row[col];
      if (val === null) return 'NULL';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
    content += '| ' + values.join(' | ') + ' |\n';
  }
  
  if (result.data.length > 100) {
    content += `\n*... and ${result.data.length - 100} more rows*`;
  }
  
  return content;
}

export default function SqlQueryResultTab({ queryId }: SqlQueryResultTabProps) {
  const { supabaseConfig, openTabs, setTabData } = useWorkspace();
  const backend = useBackend();
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editableQuery, setEditableQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Extract query from tab content (stored when tab was opened)
  const tabPath = `sql-result:${queryId}`;
  const tab = openTabs.find(t => t.path === tabPath);

  useEffect(() => {
    if (tab?.content) {
      try {
        const stored = JSON.parse(tab.content);
        if (stored.query) {
          setQuery(stored.query);
          setEditableQuery(stored.query);
        }
        if (stored.result) {
          setResult(stored.result);
          setLoading(false);
        }
      } catch {
        // Content might not be JSON yet
      }
    }
  }, [tab?.content]);

  const executeQuery = async (queryToRun: string) => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setResult({
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        error: 'Missing Supabase credentials',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const queryResult = await backend.supabaseExecuteQuery(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey,
        queryToRun
      );
      
      setResult(queryResult);
      setQuery(queryToRun);
      
      // Store result in tab content for persistence
      setTabData(tabPath, JSON.stringify({
        query: queryToRun,
        result: queryResult,
      }));
      
      // Update context-friendly version
      if (queryResult.success) {
        // Tab data already set above
      }
    } catch (err) {
      setResult({
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = () => {
    if (editableQuery.trim()) {
      setIsEditing(false);
      executeQuery(editableQuery.trim());
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="sql-result-tab">
      <div className="sql-result-header">
        <div className="sql-result-title">
          <DatabaseIcon size={20} />
          <h2>Query Results</h2>
          {result && result.success && (
            <span className="sql-result-count">{result.rowCount} rows</span>
          )}
          {result?.executionTime && (
            <span className="sql-result-time">{result.executionTime}ms</span>
          )}
        </div>
        <button 
          className="sql-rerun-btn" 
          onClick={handleRerun}
          disabled={loading || !editableQuery.trim()}
          title="Re-run query"
        >
          <PlayIcon size={12} /> Run
        </button>
      </div>

      {/* Query Editor */}
      <div className="sql-query-section">
        <div className="sql-query-header">
          <span>SQL Query</span>
          <button 
            className="sql-edit-btn"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Hide Editor' : 'Edit Query'}
          </button>
        </div>
        {isEditing ? (
          <textarea
            className="sql-query-editor"
            value={editableQuery}
            onChange={(e) => setEditableQuery(e.target.value)}
            placeholder="Enter SQL query..."
            rows={4}
          />
        ) : (
          <pre className="sql-query-display">{query || 'No query'}</pre>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="sql-result-loading">
          <div className="sb-spinner"></div>
          <span>Executing query...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && result && !result.success && (
        <div className="sql-result-error">
          <span className="sql-error-icon">⚠️</span>
          <div className="sql-error-content">
            <strong>Query Error</strong>
            <p>{result.error}</p>
          </div>
        </div>
      )}

      {/* Empty Results */}
      {!loading && result && result.success && result.data.length === 0 && (
        <div className="sql-result-empty">
          <span>📭</span>
          <p>No rows returned</p>
        </div>
      )}

      {/* Results Table */}
      {!loading && result && result.success && result.data.length > 0 && (
        <div className="sql-result-table-wrapper">
          <table className="sql-result-table">
            <thead>
              <tr>
                {result.columns.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {result.columns.map((col, colIndex) => (
                    <td key={colIndex} title={formatValue(row[col])}>
                      {formatValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
