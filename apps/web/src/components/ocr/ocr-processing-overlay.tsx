import { Loader2 } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface OcrProcessingOverlayProps {
  progress?: number;
}

export function OcrProcessingOverlay({ progress }: OcrProcessingOverlayProps) {
  return (
    <div className="relative">
      {/* Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-6 animate-spin text-primary" />
          {progress != null && (
            <div className="w-48">
              <Progress value={progress} />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-semibold">Analyzing invoice...</p>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
          </div>
        </div>
      </div>

      {/* Skeleton fields underneath */}
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
