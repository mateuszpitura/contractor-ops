'use client';

import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
}

function getConfidenceConfig(confidence: number) {
  if (confidence > 90) {
    return {
      variant: 'success' as const,
      icon: CheckCircle2,
      tooltip: `High confidence: ${confidence}%`,
    };
  }
  if (confidence >= 70) {
    return {
      variant: 'warning' as const,
      icon: AlertTriangle,
      tooltip: `Medium confidence: ${confidence}% -- please verify`,
    };
  }
  return {
    variant: 'destructive' as const,
    icon: AlertCircle,
    tooltip: `Low confidence: ${confidence}% -- manual review needed`,
  };
}

export function ConfidenceBadge({ confidence, showPercentage = true }: ConfidenceBadgeProps) {
  const { variant, icon: Icon, tooltip } = getConfidenceConfig(confidence);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant={variant}
            aria-label={showPercentage ? undefined : `${confidence}% confidence`}>
            <Icon className="size-3.5" />
            {showPercentage && <span className="tabular-nums">{confidence}%</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { getConfidenceConfig };
