/**
 * Origin-style multi-file dropzone with native drag-and-drop semantics.
 *
 * Stands in for `@origin/file-upload` since originui.com redirected to
 * coss.com/ui without a stable `/r/*` JSON registry (probed 2026-05-26).
 * Pattern matches the originui multi-file upload variant: drag-state,
 * file list, remove-per-file, total size, optional max size guard.
 */

import { File as FileIcon, Upload, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils.js';
import { Button } from '../shadcn/button.js';

export interface FileUploadProps {
  files: readonly File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeBytes?: number;
  multiple?: boolean;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  files,
  onFilesChange,
  accept,
  maxFiles,
  maxSizeBytes,
  multiple = true,
  label = 'Drop files here',
  description = 'or click to browse',
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const resolvedAccept = accept ?? undefined;

  const acceptFiles = React.useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      let next = [...files, ...Array.from(incoming)];
      if (maxSizeBytes) next = next.filter(f => f.size <= maxSizeBytes);
      if (maxFiles) next = next.slice(0, maxFiles);
      onFilesChange(next);
    },
    [files, maxFiles, maxSizeBytes, onFilesChange],
  );

  const removeAt = React.useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index);
      onFilesChange(next);
    },
    [files, onFilesChange],
  );

  const handleDropzoneClick = React.useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleDropzoneKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled],
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      acceptFiles(e.dataTransfer.files);
    },
    [acceptFiles, disabled],
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      acceptFiles(e.target.files);
    },
    [acceptFiles],
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleDropzoneClick}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-disabled={disabled}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragging && 'border-primary bg-primary/5',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/60',
        )}>
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={resolvedAccept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <FileRow
              // Composite of File-stable fields (size + lastModified) survives
              // reorders/removals; index is the disambiguator for genuinely
              // identical files dropped in the same batch.
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              file={file}
              index={index}
              onRemove={removeAt}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface FileRowProps {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}

const FileRow = React.memo(function FileRow({ file, index, onRemove }: FileRowProps) {
  const handleRemove = React.useCallback(() => onRemove(index), [index, onRemove]);
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2 truncate">
        <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-foreground">{file.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${file.name}`}
        onClick={handleRemove}>
        <X className="size-4" aria-hidden />
      </Button>
    </li>
  );
});
