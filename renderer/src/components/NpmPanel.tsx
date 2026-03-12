import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

function ProjectSection({ name, relativePath, absolutePath, scripts, runNpmScript }: {
  name: string;
  relativePath: string;
  absolutePath: string;
  scripts: Record<string, string>;
  runNpmScript: (projectPath: string, scriptName: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const scriptNames = Object.keys(scripts);

  return (
    <div className="npm-project-section">
      <button
        className="npm-project-hdr"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="npm-project-arrow">{expanded ? '▼' : '▶'}</span>
        <span className="npm-project-icon">📦</span>
        <span className="npm-project-name">{name}</span>
        <span className="npm-project-path">{relativePath === '.' ? '(root)' : relativePath}</span>
        <span className="npm-project-count">{scriptNames.length}</span>
      </button>
      {expanded && (
        <div className="npm-script-list">
          {scriptNames.map(scriptName => (
            <button
              key={scriptName}
              className="npm-script-btn"
              onClick={() => runNpmScript(absolutePath, scriptName)}
              title={`Run: npm run ${scriptName}\n${scripts[scriptName]}`}
            >
              <span className="npm-script-play">▶</span>
              <span className="npm-script-name">{scriptName}</span>
              <span className="npm-script-cmd">{scripts[scriptName]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NpmPanel() {
  const { npmProjects, runNpmScript } = useWorkspace();

  return (
    <div className="npm-panel">
      <div className="npm-panel-hdr">
        <span className="npm-panel-icon">📦</span>
        <span className="npm-panel-title">NPM Scripts</span>
        <span className="npm-panel-total">{npmProjects.length} project{npmProjects.length !== 1 ? 's' : ''}</span>
      </div>

      {npmProjects.length === 0 ? (
        <div className="npm-panel-empty">No package.json files with scripts found</div>
      ) : (
        <div className="npm-projects-list">
          {npmProjects.map(project => (
            <ProjectSection
              key={project.absolutePath}
              name={project.name}
              relativePath={project.relativePath}
              absolutePath={project.absolutePath}
              scripts={project.scripts}
              runNpmScript={runNpmScript}
            />
          ))}
        </div>
      )}
    </div>
  );
}
