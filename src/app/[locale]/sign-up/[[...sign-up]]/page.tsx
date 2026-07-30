import { SignUp } from '@clerk/nextjs';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { CLERK_ENABLED } from '@/lib/auth';

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!CLERK_ENABLED) redirect(`/${locale}`);

  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="/full_logo.png"
          alt={t('signUp')}
          width={381}
          height={88}
          priority
          className="mb-1 h-9 w-auto"
        />
        <h1 className="font-serif text-[22px] font-semibold text-ink">{t('signUp')}</h1>
        <p className="max-w-sm text-[13px] text-muted">{t('ownerAccess')}</p>
      </div>
      <SignUp />
    </div>
  );
}
