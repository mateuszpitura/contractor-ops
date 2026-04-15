'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  accountNumberSchema,
  bacsSubmitterNameSchema,
  serviceUserNumberSchema,
  sortCodeSchema,
} from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const submitterFormSchema = z.object({
  serviceUserNumber: serviceUserNumberSchema,
  submitterSortCode: sortCodeSchema,
  submitterAccountNumber: accountNumberSchema,
  submitterName: bacsSubmitterNameSchema,
});

type SubmitterFormValues = z.infer<typeof submitterFormSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BacsSubmitterFormProps {
  /** When true, Save button is disabled (feature flag off). */
  disabled?: boolean;
}

export function BacsSubmitterForm({ disabled = false }: BacsSubmitterFormProps) {
  const t = useTranslations('Payments');
  const queryClient = useQueryClient();

  const form = useForm<SubmitterFormValues>({
    resolver: zodResolver(submitterFormSchema),
    defaultValues: {
      serviceUserNumber: '',
      submitterSortCode: '',
      submitterAccountNumber: '',
      submitterName: '',
    },
    mode: 'onBlur',
  });

  const saveMutation = useMutation(
    trpc.bacs.saveSubmitterConfig.mutationOptions({
      onSuccess(data) {
        toast.success(t('toastSubmitterSaved'));
        // Update masked preview values after save
        form.reset();
        queryClient.invalidateQueries();
      },
      onError() {
        toast.error(t('toastSubmitterError'));
      },
    }),
  );

  function onSubmit(values: SubmitterFormValues) {
    saveMutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('submitterCardTitle')}</CardTitle>
        <CardDescription>{t('submitterCardDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceUserNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sunLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="off"
                      className="font-mono tabular-nums"
                    />
                  </FormControl>
                  <FormDescription>{t('sunHelper')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitterSortCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('originatingSortCodeLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="off"
                      className="font-mono tabular-nums"
                    />
                  </FormControl>
                  <FormDescription>{t('originatingSortCodeHelper')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitterAccountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('originatingAccountLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="00000000"
                      maxLength={8}
                      inputMode="numeric"
                      autoComplete="off"
                      className="font-mono tabular-nums"
                    />
                  </FormControl>
                  <FormDescription>{t('originatingAccountHelper')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitterName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('submitterNameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="COMPANY NAME"
                      maxLength={18}
                      autoComplete="off"
                      className="font-mono uppercase"
                    />
                  </FormControl>
                  <FormDescription>{t('submitterNameHelper')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={disabled || !form.formState.isValid || saveMutation.isPending}
              className="w-full sm:w-auto"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('saveSubmitter')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
