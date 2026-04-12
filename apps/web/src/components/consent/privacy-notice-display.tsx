'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrivacyNoticeSection {
  title: string;
  content: string;
}

interface PrivacyNoticeContent {
  jurisdiction: string;
  legalReference: string;
  controller: {
    name: string;
    country: string;
  };
  sections: PrivacyNoticeSection[];
}

interface PrivacyNoticeDisplayProps {
  notice: PrivacyNoticeContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrivacyNoticeDisplay({ notice }: PrivacyNoticeDisplayProps) {
  const t = useTranslations('Consent');

  const jurisdictionLabel = notice.jurisdiction === 'AE' ? 'UAE PDPL' : 'Saudi PDPL';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{t('privacyNotice.title')}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {jurisdictionLabel}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{notice.legalReference}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <strong>{t('privacyNotice.controller')}:</strong> {notice.controller.name} (
          {notice.controller.country})
        </div>

        {notice.sections.map((section, index) => (
          <Collapsible key={`section-${index}`}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
              <span>{section.title}</span>
              <span className="text-xs text-muted-foreground">{t('privacyNotice.expand')}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-2 text-xs leading-relaxed text-muted-foreground">
                {section.content}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
