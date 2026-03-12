import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import EditorTabs from './EditorTabs';
import DiffViewer from './DiffViewer';
import SupabaseUsersTab from './SupabaseUsersTab';
import SupabaseStorageTab from './SupabaseStorageTab';
import SqlQueryResultTab from './SqlQueryResultTab';
import GitHubLogsViewer from './GitHubLogsViewer';
import AgentsPanel from './AgentsPanel';
import WorkflowEditor from './WorkflowEditor';
import AIDebugPanel from './AIDebugPanel';
import type { DiffResult } from '../types';

export default function Editor() {
  const { openTabs, activeTabPath, updateTabContent, saveFile } = useWorkspace();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLPreElement>(null);
  const [htmlFileViewMode, setHtmlFileViewMode] = useState<'preview' | 'code'>('preview');
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  const isDiff = activeTab?.path.startsWith('diff:');
  const isSupabaseUsers = activeTab?.path === 'supabase:users';
  const isSupabaseStorage = activeTab?.path === 'supabase:storage';
  const isSqlResult = activeTab?.path.startsWith('sql-result:');
  const isGitHubLogs = activeTab?.path.startsWith('github-logs:');
  const isAgents = activeTab?.path === 'agents:flow';
  const isWorkflow = activeTab?.path.startsWith('workflow:');
  const isDebugTrace = activeTab?.path === 'debug:trace';
  const isHtmlPreview = activeTab?.path.startsWith('html-preview:');
  const isHtmlFile = !isDiff && !isHtmlPreview && activeTab?.path.endsWith('.html');

  // Reset to preview mode when switching to a different html file
  useEffect(() => {
    if (isHtmlFile) setHtmlFileViewMode('preview');
  }, [activeTabPath]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (activeTabPath) saveFile(activeTabPath); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTabPath, saveFile]);

  const updateLines = useCallback(() => {
    if (!textareaRef.current || !lineNumRef.current) return;
    const count = textareaRef.current.value.split('\n').length;
    lineNumRef.current.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  }, []);

  useEffect(updateLines, [activeTab?.content, updateLines]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (activeTabPath) updateTabContent(activeTabPath, e.target.value);
    updateLines();
  };

  const handleScroll = () => {
    if (lineNumRef.current && textareaRef.current) lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current!;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      ta.value = value.substring(0, s) + '  ' + value.substring(end);
      ta.selectionStart = ta.selectionEnd = s + 2;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  if (!activeTab) return null;


  // Diff view
  if (isDiff) {
    let diff: DiffResult;
    try { diff = JSON.parse(activeTab.content); }
    catch { diff = { oldContent: '', newContent: activeTab.content }; }
    const realPath = activeTab.path.replace('diff:', '');
    const fileName = realPath.split('/').pop() ?? realPath;
    return (
      <div className="editor-container">
        <EditorTabs />
        <DiffViewer diff={diff} fileName={fileName} />
      </div>
    );
  }

  // Supabase Users view
  if (isSupabaseUsers) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <SupabaseUsersTab />
      </div>
    );
  }

  // Supabase Storage view
  if (isSupabaseStorage) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <SupabaseStorageTab />
      </div>
    );
  }

  // SQL Query Result view
  if (isSqlResult) {
    const queryId = activeTab.path.replace('sql-result:', '');
    return (
      <div className="editor-container">
        <EditorTabs />
        <SqlQueryResultTab queryId={queryId} />
      </div>
    );
  }

  // GitHub Logs view
  if (isGitHubLogs) {
    const jobName = activeTab.name.replace('Logs: ', '');
    return (
      <div className="editor-container">
        <EditorTabs />
        <GitHubLogsViewer logs={activeTab.content} jobName={jobName} />
      </div>
    );
  }

  // Agents flow view
  if (isAgents) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <AgentsPanel />
      </div>
    );
  }

  // Workflow editor view
  if (isWorkflow) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <WorkflowEditor />
      </div>
    );
  }

  // AI Debug trace view
  if (isDebugTrace) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <AIDebugPanel />
      </div>
    );
  }

  // HTML Preview tab — renders full HTML in a sandboxed iframe
  if (isHtmlPreview) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <div className="html-preview-tab">
          <div className="html-preview-tab-toolbar">
            <span className="html-preview-tab-label">🌐 {activeTab.name.replace('🌐 ', '')}</span>
            <span className="html-preview-tab-badge">Preview</span>
          </div>
          <iframe
            className="html-preview-tab-frame"
            srcDoc={activeTab.content}
            sandbox="allow-scripts allow-same-origin"
            title={activeTab.name}
          />
        </div>
      </div>
    );
  }

  // Regular .html file — show as iframe preview with code toggle
  if (isHtmlFile) {
    return (
      <div className="editor-container">
        <EditorTabs />
        <div className="html-preview-tab">
          <div className="html-preview-tab-toolbar">
            <span className="html-preview-tab-label">🌐 {activeTab.name}</span>
            <div className="html-preview-tab-toggle">
              <button
                className={`html-preview-tab-toggle-btn ${htmlFileViewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setHtmlFileViewMode('preview')}
              >
                Preview
              </button>
              <button
                className={`html-preview-tab-toggle-btn ${htmlFileViewMode === 'code' ? 'active' : ''}`}
                onClick={() => setHtmlFileViewMode('code')}
              >
                Code
              </button>
            </div>
            <div className="editor-actions">
              {activeTab.readOnly ? (
                <span className="readonly-badge">Read Only</span>
              ) : (
                <>
                  <span className={activeTab.modified ? 'modified' : 'saved'}>{activeTab.modified ? 'Modified' : 'Saved'}</span>
                  <button className="btn-save" onClick={() => saveFile(activeTabPath!)}>💾 Save</button>
                </>
              )}
            </div>
          </div>
          {htmlFileViewMode === 'preview' ? (
            <iframe
              className="html-preview-tab-frame"
              srcDoc={activeTab.content}
              sandbox="allow-scripts allow-same-origin"
              title={activeTab.name}
            />
          ) : (
            <div className="editor-body">
              <pre className="line-numbers" ref={lineNumRef} />
              <textarea
                ref={textareaRef}
                className="code-area"
                value={activeTab.content}
                onChange={handleChange}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                readOnly={activeTab.readOnly}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <EditorTabs />
      <div className="editor-toolbar">
        <span className="editor-path">{activeTab.path}</span>
        <div className="editor-actions">
          {activeTab.readOnly ? (
            <span className="readonly-badge">Read Only</span>
          ) : (
            <>
              <span className={activeTab.modified ? 'modified' : 'saved'}>{activeTab.modified ? 'Modified' : 'Saved'}</span>
              <button className="btn-save" onClick={() => saveFile(activeTabPath!)}>💾 Save</button>
            </>
          )}
        </div>
      </div>
      <div className="editor-body">
        <pre className="line-numbers" ref={lineNumRef} />
        <textarea
          ref={textareaRef}
          className="code-area"
          value={activeTab.content}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={activeTab.readOnly}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
