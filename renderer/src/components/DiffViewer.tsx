import type { DiffResult } from '../types';

interface Props {
  diff: DiffResult;
  fileName: string;
}

function computeLineDiff(oldLines: string[], newLines: string[]) {
  const result: { type: 'same' | 'add' | 'remove'; line: string }[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', line: oldLines[oi] });
      oi++; ni++;
    } else if (oi < oldLines.length && (ni >= newLines.length || !newLines.slice(ni, ni + 3).includes(oldLines[oi]))) {
      result.push({ type: 'remove', line: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: 'add', line: newLines[ni] });
      ni++;
    }
    if (result.length > maxLen * 3) break; // safety
  }
  return result;
}

export default function DiffViewer({ diff, fileName }: Props) {
  const oldLines = diff.oldContent.split('\n');
  const newLines = diff.newContent.split('\n');
  const lines = computeLineDiff(oldLines, newLines);

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <span>Δ {fileName}</span>
        <span className="diff-stats">
          <span style={{ color: '#50fa7b' }}>+{lines.filter(l => l.type === 'add').length}</span>
          {' '}
          <span style={{ color: '#e05555' }}>-{lines.filter(l => l.type === 'remove').length}</span>
        </span>
      </div>
      <pre className="diff-body">
        {lines.map((l, i) => (
          <div key={i} className={`diff-line ${l.type}`}>
            <span className="diff-sign">{l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' '}</span>
            <span>{l.line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
