import { setRequestLocale } from 'next-intl/server';
import { HotelsView } from '@/components/hotels/HotelsView';

export default async function HotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HotelsView />;
}
