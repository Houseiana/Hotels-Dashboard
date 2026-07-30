import { setRequestLocale } from 'next-intl/server';
import { OverviewView } from '@/components/overview/OverviewView';

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OverviewView />;
}
