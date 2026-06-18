/**
 * First-run organization onboarding — shown full-screen by the dashboard
 * shell when a signed-in user has no active organization to fall back to.
 *
 * Step 1 collects the organization name + billing country and creates the org
 * (Better Auth `organization.create` + `setActive`). Step 2 confirms success
 * and teases the next setup actions (placeholders until those flows land), then
 * reloads into the dashboard. Wiring lives in `hooks/use-organization-onboarding.ts`;
 * this file owns layout, copy, and field rendering only.
 */

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from '@contractor-ops/ui/components/reui/stepper';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { ArrowRight, Building2, CreditCard, Loader2, Sparkles, Upload, Users } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Controller } from 'react-hook-form';

import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { useOrganizationOnboarding } from './hooks/use-organization-onboarding.js';

const STEP_COUNT = 2;

function OnboardingBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="aurora-bg grain-overlay relative flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="orb orb-teal absolute top-[12%] left-[12%] h-[320px] w-[320px]" />
      <div className="orb orb-violet absolute top-[55%] right-[14%] h-[260px] w-[260px]" />
      <div className="orb orb-amber absolute bottom-[16%] left-[42%] h-[220px] w-[220px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_72%)]" />
      <div className="relative z-10 w-full max-w-xl space-y-8">{children}</div>
    </div>
  );
}

function OnboardingStepIndicator({
  currentStep,
  steps,
  ariaLabel,
}: {
  currentStep: number;
  steps: Array<{ step: number; label: string }>;
  ariaLabel: string;
}) {
  return (
    <Stepper value={currentStep} aria-label={ariaLabel} aria-readonly="true">
      <StepperNav className="justify-center gap-6">
        {steps.map(({ step, label }, index) => (
          <StepperItem key={step} step={step} className="items-center">
            <div
              className="flex items-center gap-1.5"
              aria-current={step === currentStep ? 'step' : undefined}>
              <StepperIndicator className="size-6 text-xs">{step}</StepperIndicator>
              <StepperTitle className="hidden text-sm sm:inline">{label}</StepperTitle>
            </div>
            {index < steps.length - 1 && (
              <StepperSeparator className="mx-2 hidden h-px w-8 sm:block" />
            )}
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
}

type DetailsStep = Pick<
  ReturnType<typeof useOrganizationOnboarding>,
  'fieldId' | 'isSubmitting' | 'countryOptions' | 'register' | 'control' | 'errors' | 'onSubmit'
>;

function OrgDetailsStep({
  fieldId,
  isSubmitting,
  countryOptions,
  register,
  control,
  errors,
  onSubmit,
}: DetailsStep) {
  const t = useTranslations('OrganizationOnboarding.step1');

  return (
    <div className="conic-border rounded-xl">
      <Card className="glass-medium border-0 shadow-2xl ring-0 hover:shadow-2xl hover:ring-0">
        <CardHeader className="space-y-1">
          <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-name`} className="text-[13px]">
                {t('nameLabel')}
              </Label>
              <Input
                id={`${fieldId}-name`}
                autoComplete="organization"
                placeholder={t('namePlaceholder')}
                disabled={isSubmitting}
                aria-invalid={!!errors.orgName}
                aria-describedby={errors.orgName ? `${fieldId}-name-error` : undefined}
                {...register('orgName')}
              />
              {!!errors.orgName && (
                <p id={`${fieldId}-name-error`} role="alert" className="text-sm text-destructive">
                  {errors.orgName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-country`} className="text-[13px]">
                {t('countryLabel')}
              </Label>
              <Controller
                control={control}
                name="billingCountry"
                // biome-ignore lint/nursery/noJsxPropsBind: react-hook-form Controller render prop — extraction is premature optimization
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}>
                    <SelectTrigger
                      id={`${fieldId}-country`}
                      className="w-full"
                      aria-invalid={!!errors.billingCountry}
                      aria-describedby={`${fieldId}-country-help${
                        errors.billingCountry ? ` ${fieldId}-country-error` : ''
                      }`}>
                      <SelectValue placeholder={t('countryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map(option => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p id={`${fieldId}-country-help`} className="text-xs text-muted-foreground">
                {t('countryHelp')}
              </p>
              {!!errors.billingCountry && (
                <p
                  id={`${fieldId}-country-error`}
                  role="alert"
                  className="text-sm text-destructive">
                  {errors.billingCountry.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function NextActionCard({
  icon: Icon,
  title,
  description,
  comingSoonLabel,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  comingSoonLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-4 text-start">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {comingSoonLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function WelcomeNextStep({ orgName, onFinish }: { orgName: string; onFinish: () => void }) {
  const t = useTranslations('OrganizationOnboarding.step2');
  const comingSoon = t('comingSoon');

  const actions = [
    { icon: Users, title: t('next.inviteTitle'), description: t('next.inviteDesc') },
    { icon: Upload, title: t('next.importTitle'), description: t('next.importDesc') },
    { icon: CreditCard, title: t('next.billingTitle'), description: t('next.billingDesc') },
  ];

  return (
    <div className="conic-border rounded-xl">
      <Card className="glass-medium border-0 shadow-2xl ring-0 hover:shadow-2xl hover:ring-0">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="font-display text-xl font-semibold leading-tight">
            {t('heading', { orgName })}
          </h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map(action => (
              <NextActionCard
                key={action.title}
                icon={action.icon}
                title={action.title}
                description={action.description}
                comingSoonLabel={comingSoon}
              />
            ))}
          </div>
          <Button className="w-full" onClick={onFinish}>
            {t('finish')}
            <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizationOnboardingContainer() {
  const t = useTranslations('OrganizationOnboarding');
  const tAria = useTranslations('Common.aria');
  const onboarding = useOrganizationOnboarding();

  const steps = [
    { step: 1, label: t('nav.step1Label') },
    { step: 2, label: t('nav.step2Label') },
  ];

  return (
    <OnboardingBackdrop>
      <AnimateIn delay={0}>
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {t('eyebrow')}
          </span>
          <h1 className="gradient-text font-display text-3xl font-bold leading-[1.15] tracking-tight">
            {t('title')}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </AnimateIn>

      <AnimateIn delay={1}>
        <div className="space-y-3">
          <OnboardingStepIndicator
            currentStep={onboarding.step}
            steps={steps}
            ariaLabel={tAria('wizardProgress')}
          />
          <Progress value={(onboarding.step / STEP_COUNT) * 100} />
        </div>
      </AnimateIn>

      <AnimateIn delay={2}>
        {onboarding.step === 1 ? (
          <OrgDetailsStep
            fieldId={onboarding.fieldId}
            isSubmitting={onboarding.isSubmitting}
            countryOptions={onboarding.countryOptions}
            register={onboarding.register}
            control={onboarding.control}
            errors={onboarding.errors}
            onSubmit={onboarding.onSubmit}
          />
        ) : (
          <WelcomeNextStep orgName={onboarding.createdOrgName} onFinish={onboarding.onFinish} />
        )}
      </AnimateIn>
    </OnboardingBackdrop>
  );
}
