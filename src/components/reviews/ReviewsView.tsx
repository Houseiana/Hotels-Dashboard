'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Lock, MessageSquareReply, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Select, TextArea } from '@/components/ui/form';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { useHotels, useReplyToReview } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { REVIEW_CATEGORIES } from '@/lib/catalogs';
import type { Hotel, HotelReview } from '@/lib/schemas/hotel';
import { cn, formatDate } from '@/lib/utils';

type Filter = 'all' | 'unanswered' | 'answered';
type Sort = 'newest' | 'highest' | 'lowest';

function scoreWord(score: number, t: (key: string) => string): string {
  if (score >= 9) return t('scoreExcellent');
  if (score >= 8) return t('scoreVeryGood');
  if (score >= 7) return t('scoreGood');
  if (score >= 6) return t('scorePleasant');
  return t('scorePoor');
}

function ReplyBox({ hotelId, review }: { hotelId: string; review: HotelReview }) {
  const t = useTranslations('reviews');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const reply = useReplyToReview();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.ownerReply ?? '');

  const submit = () => {
    reply.mutate(
      { hotelId, reviewId: review.id, reply: text },
      {
        onSuccess: () => {
          toast(t('replySaved'));
          setOpen(false);
        },
        onError: () => toast(tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  if (!open) {
    return review.ownerReply ? (
      <div className="flex flex-col gap-1.5 rounded-[var(--radius-ctl)] border-s-[3px] border-accent bg-accent-soft/50 p-3">
        <span className="text-[11px] font-bold uppercase tracking-[.06em] text-accent-ink">
          {t('yourReply')}
        </span>
        <p className="text-[13px] leading-relaxed text-ink">{review.ownerReply}</p>
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
          {t('editReply')}
        </Button>
      </div>
    ) : (
      <Button size="sm" variant="ghost" className="self-start text-accent-ink" onClick={() => setOpen(true)}>
        <MessageSquareReply className="size-3.5" />
        {t('reply')}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('replyPlaceholder')}
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={reply.isPending}>
          {reply.isPending ? tCommon('saving') : t('sendReply')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setText(review.ownerReply ?? '');
            setOpen(false);
          }}
        >
          {tCommon('cancel')}
        </Button>
      </div>
    </div>
  );
}

function BreakdownCard({ hotel }: { hotel: Hotel }) {
  const t = useTranslations('reviews');
  const labels = useCatalogLabels();
  const breakdown = hotel.ratingBreakdown ?? {};

  return (
    <Card>
      <CardHeader title={t('breakdown')} />
      <CardBody>
        <div className="flex items-center gap-3 rounded-[var(--radius-ctl)] bg-surface-2 p-3">
          <span className="grid size-12 place-items-center rounded-[10px] bg-accent text-[19px] font-bold text-on-accent latn">
            {hotel.rating?.toFixed(1) ?? '—'}
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold text-ink">
              {hotel.rating ? scoreWord(hotel.rating, t) : t('emptyTitle')}
            </span>
            <span className="text-[12px] text-muted">
              {t('basedOn', { count: hotel.reviewCount ?? 0 })}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {REVIEW_CATEGORIES.map((category) => {
            const value = breakdown[category];
            return (
              <div key={category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-muted">{labels.reviewCategory(category)}</span>
                  <span className="font-semibold text-ink latn">
                    {value !== undefined ? value.toFixed(1) : '—'}
                    <small className="ms-0.5 font-normal text-faint">{t('outOfTen')}</small>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{ width: `${((value ?? 0) / 10) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="flex items-start gap-2 rounded-[var(--radius-ctl)] bg-info-soft p-2.5 text-[11.5px] text-muted">
          <Lock className="mt-px size-3.5 shrink-0 text-info" />
          {t('readOnlyNotice')}
        </p>
      </CardBody>
    </Card>
  );
}

export function ReviewsView() {
  const t = useTranslations('reviews');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { hotelId } = useHotelScope();
  const { data: hotels, isPending, isError } = useHotels();

  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const scoped = useMemo(
    () => (hotels ?? []).filter((h) => !hotelId || h.id === hotelId),
    [hotels, hotelId],
  );

  const rows = useMemo(() => {
    const all = scoped.flatMap((hotel) =>
      (hotel.reviews ?? []).map((review) => ({ hotel, review })),
    );
    const matched = all.filter(({ review }) =>
      filter === 'all'
        ? true
        : filter === 'answered'
          ? Boolean(review.ownerReply)
          : !review.ownerReply,
    );
    return matched.sort((a, b) => {
      if (sort === 'highest') return b.review.score - a.review.score;
      if (sort === 'lowest') return a.review.score - b.review.score;
      return a.review.date < b.review.date ? 1 : -1;
    });
  }, [scoped, filter, sort]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={<Star className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={tCommon('retry')}
        />
      </div>
    );
  }

  const singleHotel = scoped.length === 1 ? scoped[0] : undefined;
  const isFiltered = filter !== 'all';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4 lg:order-2">
          <div className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-2.5 shadow-[var(--shadow-card)]">
            <div className="w-[190px] shrink-0">
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                aria-label={tCommon('filter')}
              >
                <option value="all">{t('filterAll')}</option>
                <option value="unanswered">{t('filterUnanswered')}</option>
                <option value="answered">{t('filterAnswered')}</option>
              </Select>
            </div>
            <div className="w-[180px] shrink-0">
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label={tCommon('filter')}
              >
                <option value="newest">{t('sortNewest')}</option>
                <option value="highest">{t('sortHighest')}</option>
                <option value="lowest">{t('sortLowest')}</option>
              </Select>
            </div>
            <span className="ms-auto text-[12.5px] text-faint">
              {t('basedOn', { count: rows.length })}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Star className="size-5" />}
              title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
              body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map(({ hotel, review }) => (
                <Card key={review.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-[9px] text-[15px] font-bold text-white latn',
                        review.score >= 8 ? 'bg-accent' : review.score >= 6 ? 'bg-warn' : 'bg-danger',
                      )}
                    >
                      {review.score.toFixed(1)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{review.author}</span>
                        {review.country ? (
                          <span className="text-[11.5px] text-faint latn">{review.country}</span>
                        ) : null}
                        <Chip tone="neutral" className="px-2 py-0 text-[10.5px]">
                          {scoreWord(review.score, t)}
                        </Chip>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
                        <span className="latn">{formatDate(review.date, locale)}</span>
                        {review.roomType ? (
                          <>
                            <span>·</span>
                            <span>{t('stayedIn', { room: review.roomType })}</span>
                          </>
                        ) : null}
                        {!hotelId ? (
                          <>
                            <span>·</span>
                            <span>{hotel.name}</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {!review.ownerReply ? (
                      <Chip tone="draft" className="ms-auto shrink-0">
                        {t('filterUnanswered')}
                      </Chip>
                    ) : null}
                  </div>

                  {review.positive ? (
                    <p className="flex gap-2 text-[13px] leading-relaxed text-ink">
                      <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-ok" />
                      <span>
                        <b className="me-1 font-semibold text-muted">{t('liked')}:</b>
                        {review.positive}
                      </span>
                    </p>
                  ) : null}

                  {review.negative ? (
                    <p className="flex gap-2 text-[13px] leading-relaxed text-ink">
                      <ThumbsDown className="mt-0.5 size-3.5 shrink-0 text-danger" />
                      <span>
                        <b className="me-1 font-semibold text-muted">{t('disliked')}:</b>
                        {review.negative}
                      </span>
                    </p>
                  ) : null}

                  <ReplyBox hotelId={hotel.id} review={review} />
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="lg:order-1">
          {singleHotel ? (
            <BreakdownCard hotel={singleHotel} />
          ) : (
            <Card>
              <CardBody>
                <p className="text-[13px] text-muted">{t('selectHotelFirst')}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
