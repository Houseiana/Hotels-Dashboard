import { setRequestLocale } from 'next-intl/server';
import { BookingsView } from '@/components/bookings/BookingsView';

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BookingsView />;
}
