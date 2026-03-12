import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { getBackend } from '../backend';

export interface AttachedFile {
  name: string;
  path: string;
  content?: string;
}

interface UseAttachedFilesReturn {
  attachedFiles: AttachedFile[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  dragging: boolean;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  addFile: (name: string, path: string, content?: string) => Promise<void>;
  removeFile: (path: string) => void;
  clearFiles: () => void;
  handleFilePick: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

/**
 * Hook for managing attached files in the chat
 */
export function useAttachedFiles(): UseAttachedFilesReturn {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const filePath = (f as unknown as { path: string }).path;
        if (!filePath) continue;

        const name = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? f.name;
        if (attachedFiles.some(a => a.path === filePath)) continue;

        try {
          const result = await getBackend().readFile(filePath);
          setAttachedFiles(prev => [
            ...prev,
            { name, path: filePath, content: result.success ? result.content : undefined },
          ]);
        } catch {
          setAttachedFiles(prev => [...prev, { name, path: filePath }]);
        }
      }
    },
    [attachedFiles]
  );

  const addFile = useCallback(
    async (name: string, path: string, providedContent?: string) => {
      if (attachedFiles.some(a => a.path === path)) return;

      // If content is provided directly (e.g., from special tabs), use it
      if (providedContent !== undefined) {
        setAttachedFiles(prev => [
          ...prev,
          { name, path, content: providedContent },
        ]);
        return;
      }

      // Otherwise, read from filesystem
      try {
        const result = await getBackend().readFile(path);
        setAttachedFiles(prev => [
          ...prev,
          { name, path, content: result.success ? result.content : undefined },
        ]);
      } catch {
        setAttachedFiles(prev => [...prev, { name, path }]);
      }
    },
    [attachedFiles]
  );

  const removeFile = useCallback((path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  const clearFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const handleFilePick = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const filePath = (f as unknown as { path: string }).path;
        if (!filePath) continue;

        const name = filePath.split('/').pop() ?? f.name;
        if (attachedFiles.some(a => a.path === filePath)) continue;

        try {
          const result = await getBackend().readFile(filePath);
          setAttachedFiles(prev => [
            ...prev,
            { name, path: filePath, content: result.success ? result.content : undefined },
          ]);
        } catch {
          setAttachedFiles(prev => [...prev, { name, path: filePath }]);
        }
      }

      // Reset input
      e.target.value = '';
    },
    [attachedFiles]
  );

  return {
    attachedFiles,
    setAttachedFiles,
    dragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    addFile,
    removeFile,
    clearFiles,
    handleFilePick,
  };
}
