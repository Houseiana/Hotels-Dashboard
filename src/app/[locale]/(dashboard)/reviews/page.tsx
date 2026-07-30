import { setRequestLocale } from 'next-intl/server';
import { ReviewsView } from '@/components/reviews/ReviewsView';

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewsView />;
}
