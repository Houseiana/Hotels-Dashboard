import { setRequestLocale } from 'next-intl/server';
import { HotelDetailView } from '@/components/hotels/HotelDetailView';

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <HotelDetailView hotelId={id} />;
}
