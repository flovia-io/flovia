/**
 * DatabasePanel - Database explorer with support for multiple database types
 * Auto-detects Supabase projects and uses them as PostgreSQL connections
 * Features:
 * - Database type selection
 * - Auto-detection of Supabase projects
 * - Tables listing (when connected)
 * - Operations (list tables, execute query)
 * - SQL files found in workspace
 */
import { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import { 
  DatabaseIcon, 
  ChevronDownIcon, 
  ChevronRightIcon, 
  PlayIcon, 
  TableIcon,
  SqlFileIcon,
  RefreshIcon,
  SupabaseIcon
} from './icons';

type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'none';

interface SqlFile {
  name: string;
  path: string;
}

interface TableInfo {
  name: string;
  schema: string;
  rowCount?: number;
}

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: number;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, isOpen, onToggle, disabled, badge, children }: AccordionSectionProps) {
  return (
    <div className={`db-accordion ${disabled ? 'db-accordion-disabled' : ''}`}>
      <button 
        className="db-accordion-header" 
        onClick={onToggle}
        disabled={disabled}
      >
        <span className="db-accordion-icon">{icon}</span>
        <span className="db-accordion-title">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="db-accordion-badge">{badge}</span>
        )}
        <span className="db-accordion-chevron">
          {isOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        </span>
      </button>
      {isOpen && !disabled && <div className="db-accordion-content">{children}</div>}
    </div>
  );
}

// Recursively find .sql files in tree
function findSqlFiles(tree: Array<{ name: string; path: string; type: string; children?: Array<unknown> }>, basePath: string = ''): SqlFile[] {
  const sqlFiles: SqlFile[] = [];
  
  for (const entry of tree) {
    const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.type === 'file' && entry.name.endsWith('.sql')) {
      sqlFiles.push({ name: entry.name, path: entry.path });
    }
    if (entry.children && Array.isArray(entry.children)) {
      sqlFiles.push(...findSqlFiles(entry.children as Array<{ name: string; path: string; type: string; children?: Array<unknown> }>, fullPath));
    }
  }
  
  return sqlFiles;
}

export default function DatabasePanel() {
  const { tree, folderPath, openFile, supabaseConfig, openSqlQueryTab } = useWorkspace();
  const backend = useBackend();
  const [selectedDb, setSelectedDb] = useState<DatabaseType>('none');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['connection', 'sql-files']));
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState('SELECT * FROM ');
  const [showQueryInput, setShowQueryInput] = useState(false);

  // Detect Supabase and auto-configure PostgreSQL
  const isSupabaseDetected = supabaseConfig?.detected && supabaseConfig?.projectUrl;
  const isConnected = isSupabaseDetected; // Connected if Supabase is detected

  // Auto-select PostgreSQL when Supabase is detected
  useEffect(() => {
    if (isSupabaseDetected) {
      setSelectedDb('postgresql');
    }
  }, [isSupabaseDetected]);

  // Find SQL files in the workspace
  const sqlFiles = useMemo(() => {
    if (!tree || tree.length === 0) return [];
    return findSqlFiles(tree as Array<{ name: string; path: string; type: string; children?: Array<unknown> }>);
  }, [tree]);

  // Fetch tables when connected to Supabase
  const fetchTables = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setConnectionError('Missing Supabase credentials');
      return;
    }

    setIsLoadingTables(true);
    setConnectionError(null);

    try {
      // Use the IPC handler to fetch tables
      const result = await backend.supabaseGetTables(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey
      );

      if (result.success) {
        setTables(result.tables.map(t => ({
          name: t.table_name,
          schema: t.table_schema,
        })));
      } else {
        setConnectionError(result.error || 'Failed to fetch tables');
      }
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to fetch tables');
    } finally {
      setIsLoadingTables(false);
    }
  };

  // Auto-load tables when Supabase is connected
  useEffect(() => {
    if (isSupabaseDetected && supabaseConfig?.serviceRoleKey) {
      fetchTables();
    }
  }, [isSupabaseDetected, supabaseConfig?.serviceRoleKey]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const databaseTypes: { id: DatabaseType; name: string; icon: string }[] = [
    { id: 'postgresql', name: 'PostgreSQL', icon: '🐘' },
    { id: 'mysql', name: 'MySQL', icon: '🐬' },
    { id: 'sqlite', name: 'SQLite', icon: '📁' },
    { id: 'mongodb', name: 'MongoDB', icon: '🍃' },
  ];

  const handleOpenSqlFile = (file: SqlFile) => {
    openFile(file.name, file.path);
  };

  const handleRunSqlFile = async (file: SqlFile) => {
    // TODO: When database is connected, execute the SQL file
    // For now, just open the file
    openFile(file.name, file.path);
  };

  const openSupabaseDashboard = () => {
    if (supabaseConfig?.projectRef) {
      window.open(`https://supabase.com/dashboard/project/${supabaseConfig.projectRef}`, '_blank');
    }
  };

  return (
    <div className="database-panel">
      <div className="database-panel-header">
        <DatabaseIcon size={20} />
        <h2>Database</h2>
      </div>

      <div className="database-panel-content">
        {/* Connection Accordion */}
        <AccordionSection
          title="Connection"
          icon={isSupabaseDetected ? <SupabaseIcon size={14} /> : "🔌"}
          isOpen={openSections.has('connection')}
          onToggle={() => toggleSection('connection')}
        >
          <div className="db-connection-status">
            <span className={`db-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span className="db-status-text">
              {isConnected ? 'Connected via Supabase' : 'Not Connected'}
            </span>
          </div>

          {isSupabaseDetected ? (
            <div className="db-supabase-info">
              <div className="db-supabase-card">
                <div className="db-supabase-icon">
                  <SupabaseIcon size={20} />
                </div>
                <div className="db-supabase-details">
                  <span className="db-supabase-project">{supabaseConfig?.projectRef || 'Supabase Project'}</span>
                  <span className="db-supabase-type">PostgreSQL</span>
                </div>
              </div>
              {supabaseConfig?.projectRef && (
                <button className="db-dashboard-btn" onClick={openSupabaseDashboard}>
                  Open Dashboard ↗
                </button>
              )}
              {!supabaseConfig?.serviceRoleKey && (
                <div className="db-connection-warning">
                  <span className="db-warning-icon">⚠️</span>
                  <span className="db-warning-text">
                    Add SUPABASE_SERVICE_ROLE_KEY to your .env file to enable full database access.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="db-type-selector">
                <label className="db-label">Database Type</label>
                <select 
                  className="db-select"
                  value={selectedDb}
                  onChange={(e) => setSelectedDb(e.target.value as DatabaseType)}
                  disabled
                >
                  <option value="none">Select database type...</option>
                  {databaseTypes.map(db => (
                    <option key={db.id} value={db.id}>
                      {db.icon} {db.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="db-connection-hint">
                <span className="db-hint-icon">ℹ️</span>
                <span className="db-hint-text">
                  Database connection coming soon. Configure your connection string to enable database features.
                </span>
              </div>
            </>
          )}
        </AccordionSection>

        {/* Tables Accordion */}
        <AccordionSection
          title="Tables"
          icon={<TableIcon size={14} />}
          isOpen={openSections.has('tables')}
          onToggle={() => toggleSection('tables')}
          disabled={!isConnected}
          badge={tables.length || undefined}
        >
          <div className="db-tables-header">
            <span className="db-tables-count">{tables.length} tables</span>
            <button 
              className="db-icon-btn" 
              title="Refresh tables" 
              onClick={fetchTables}
              disabled={!supabaseConfig?.serviceRoleKey || isLoadingTables}
            >
              <RefreshIcon size={12} className={isLoadingTables ? 'spinning' : ''} />
            </button>
          </div>
          {connectionError && (
            <div className="db-error-message">
              {connectionError}
            </div>
          )}
          {tables.length === 0 && !connectionError ? (
            <div className="db-empty-state">
              <p>{supabaseConfig?.serviceRoleKey ? 'Click refresh to load tables' : 'Add service role key to view tables'}</p>
            </div>
          ) : (
            <div className="db-tables-list">
              {tables.map(table => (
                <div key={`${table.schema}.${table.name}`} className="db-table-item">
                  <TableIcon size={12} />
                  <span className="db-table-name">{table.name}</span>
                  <span className="db-table-schema">{table.schema}</span>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

        {/* Operations Accordion */}
        <AccordionSection
          title="Operations"
          icon="⚡"
          isOpen={openSections.has('operations')}
          onToggle={() => toggleSection('operations')}
          disabled={!isConnected}
        >
          <div className="db-action-list">
            <button className="db-action-item" onClick={fetchTables} disabled={!supabaseConfig?.serviceRoleKey}>
              <span className="db-action-item-icon"><TableIcon size={14} /></span>
              <div className="db-action-item-content">
                <span className="db-action-item-title">List Tables</span>
                <span className="db-action-item-desc">Show all tables in database</span>
              </div>
            </button>
            <button 
              className="db-action-item" 
              onClick={() => setShowQueryInput(!showQueryInput)}
              disabled={!supabaseConfig?.serviceRoleKey}
            >
              <span className="db-action-item-icon">💻</span>
              <div className="db-action-item-content">
                <span className="db-action-item-title">Execute Query</span>
                <span className="db-action-item-desc">Run SQL query</span>
              </div>
            </button>
            
            {/* Query Input */}
            {showQueryInput && (
              <div className="db-query-input-section">
                <textarea
                  className="db-query-input"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="SELECT * FROM table_name"
                  rows={3}
                />
                <div className="db-query-actions">
                  <button 
                    className="db-query-run-btn"
                    onClick={() => {
                      if (queryInput.trim()) {
                        openSqlQueryTab(queryInput.trim());
                      }
                    }}
                    disabled={!queryInput.trim()}
                  >
                    <PlayIcon size={12} /> Run Query
                  </button>
                </div>
              </div>
            )}
            
            <button className="db-action-item" disabled>
              <span className="db-action-item-icon">📊</span>
              <div className="db-action-item-content">
                <span className="db-action-item-title">Schema Info</span>
                <span className="db-action-item-desc">View database schema</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* SQL Files Accordion - Always available */}
        <AccordionSection
          title="SQL Files"
          icon={<SqlFileIcon size={14} />}
          isOpen={openSections.has('sql-files')}
          onToggle={() => toggleSection('sql-files')}
          badge={sqlFiles.length}
        >
          {sqlFiles.length === 0 ? (
            <div className="db-empty-state">
              <p>No .sql files found in workspace</p>
            </div>
          ) : (
            <div className="db-sql-files-list">
              {sqlFiles.map(file => (
                <div key={file.path} className="db-sql-file-item">
                  <button 
                    className="db-sql-file-name"
                    onClick={() => handleOpenSqlFile(file)}
                    title={file.path.replace(folderPath || '', '').replace(/^\//, '')}
                  >
                    <SqlFileIcon size={12} />
                    <span>{file.name}</span>
                  </button>
                  <button 
                    className="db-sql-run-btn"
                    onClick={() => handleRunSqlFile(file)}
                    title={isConnected ? 'Run SQL file' : 'Connect to database to run'}
                    disabled={!isConnected}
                  >
                    <PlayIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}
