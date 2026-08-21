'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, LogIn, TriangleAlert } from 'lucide-react';
import { z } from 'zod';
import { Button, Card, CardBody } from '@/components/ui/primitives';
import { Field, TextInput } from '@/components/ui/form';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/components/providers/SessionProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { issueMap, validate } from '@/lib/schemas/errors';
import { ApiError } from '@/lib/api/config';

const credentialsSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
});

export function LoginForm() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const { signIn } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);

    const result = validate(credentialsSchema, { email: email.trim(), password });
    if (!result.ok) {
      setErrors(issueMap(result.issues));
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      await signIn(result.data);
      router.replace('/');
    } catch (error) {
      // 401 is the expected "wrong credentials" path; anything else is a fault
      // worth showing verbatim so the cause isn't hidden.
      setFailure(
        error instanceof ApiError && error.status === 401
          ? t('invalidCredentials')
          : error instanceof Error && error.message
            ? error.message
            : tCommon('somethingWentWrong'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/full_logo.png"
            alt={t('gateTitle')}
            width={381}
            height={88}
            priority
            className="h-9 w-auto"
          />
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-[22px] font-semibold text-ink">{t('gateTitle')}</h1>
            <p className="text-[13px] text-muted">{t('gateBody')}</p>
          </div>
        </div>

        <Card>
          <CardBody>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              {failure ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--radius-ctl)] border border-danger/40 bg-danger-soft px-3 py-2.5 text-[12.5px] font-medium text-danger"
                >
                  <TriangleAlert className="mt-px size-4 shrink-0" />
                  {failure}
                </p>
              ) : null}

              <Field
                label={t('email')}
                required
                error={labels.validation(errors['email'])}
                htmlFor="login-email"
              >
                <TextInput
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  className="text-start latn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  invalid={Boolean(errors['email'])}
                  autoFocus
                />
              </Field>

              <Field
                label={t('password')}
                required
                error={labels.validation(errors['password'])}
                htmlFor="login-password"
              >
                <div className="relative">
                  <TextInput
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    dir="ltr"
                    className="pe-10 text-start latn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(errors['password'])}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    className="absolute top-1/2 end-2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {busy ? t('signingIn') : t('signIn')}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-center text-[11.5px] text-faint">{t('ownerAccess')}</p>
      </div>
    </div>
  );
}
