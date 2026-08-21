'use client';

import { useState } from 'react';
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
import {
  useReplyToReview,
  useReviewsScreen,
  type ReviewFilter,
  type ReviewRow,
  type ReviewSort,
  type ReviewsScreen,
} from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { REVIEW_CATEGORIES } from '@/lib/catalogs';
import { cn, formatDate } from '@/lib/utils';

/** Thresholds on the API's 1-5 scale, not the 1-10 one the design started on. */
function scoreWord(score: number, t: (key: string) => string): string {
  if (score >= 4.5) return t('scoreExcellent');
  if (score >= 4) return t('scoreVeryGood');
  if (score >= 3.5) return t('scoreGood');
  if (score >= 3) return t('scorePleasant');
  return t('scorePoor');
}

function ReplyBox({ hotelId, review }: { hotelId: string; review: ReviewRow }) {
  const t = useTranslations('reviews');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const reply = useReplyToReview();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.ownerReply ?? '');

  const submit = () => {
    reply.mutate(
      // Replying and editing a reply are different endpoints; which one this
      // is depends on whether a reply already exists.
      { hotelId, reviewId: review.id, reply: text, isEdit: Boolean(review.ownerReply) },
      {
        onSuccess: () => {
          toast(t('replySaved'));
          setOpen(false);
        },
        onError: (error) =>
          toast(error?.message || tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  if (!open) {
    return review.ownerReply ? (
      <div className="flex flex-col gap-1.5 rounded-[var(--radius-ctl)] border-s-[3px] border-accent bg-accent-soft/50 p-3">
        <span className="text-[11.5px] font-bold uppercase tracking-[.05em] text-accent-ink">
          {t('yourReply')}
        </span>
        <p className="text-[13px] leading-relaxed text-ink">{review.ownerReply}</p>
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-accent-ink"
          onClick={() => setOpen(true)}
        >
          {t('editReply')}
        </Button>
      </div>
    ) : (
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
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
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={submit}
          disabled={!text.trim() || reply.isPending}
        >
          {t('sendReply')}
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

function BreakdownCard({ data }: { data: ReviewsScreen }) {
  const t = useTranslations('reviews');
  const labels = useCatalogLabels();

  // Only categories the source actually scored — the API reports six, the mock
  // reports a different seven, and neither should show invented zeroes.
  const scored = REVIEW_CATEGORIES.filter(
    (category) => typeof data.breakdown[category] === 'number',
  );

  return (
    <Card>
      <CardHeader title={t('breakdown')} />
      <CardBody>
        <div className="flex items-center gap-3 rounded-[var(--radius-ctl)] bg-surface-2 p-3">
          <span className="grid size-12 place-items-center rounded-[10px] bg-accent text-[19px] font-bold text-on-accent latn">
            {data.average?.toFixed(1) ?? '—'}
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold text-ink">
              {data.average ? scoreWord(data.average, t) : t('emptyTitle')}
            </span>
            <span className="text-[12px] text-muted">{t('basedOn', { count: data.total })}</span>
          </span>
        </div>

        {scored.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {scored.map((category) => {
              const value = data.breakdown[category] as number;
              return (
                <div key={category} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="text-muted">{labels.reviewCategory(category)}</span>
                    <span className="font-semibold text-ink latn">
                      {value.toFixed(1)}
                      <small className="ms-0.5 font-normal text-faint">{t('outOfFive')}</small>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-[width]"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

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
  const tHotels = useTranslations('hotels');
  const locale = useLocale();
  const { hotelId } = useHotelScope();

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useReviewsScreen(hotelId, filter, sort, page);

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

  if (isError || !data) {
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

  // The reviews endpoint is per hotel, so there is nothing to show until one
  // is picked — saying that beats an empty list that looks like zero reviews.
  if (data.needsHotel) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={<Star className="size-5" />}
          title={t('selectHotelFirst')}
          body={t('emptyBody')}
        />
      </div>
    );
  }

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
                onChange={(e) => {
                  setFilter(e.target.value as ReviewFilter);
                  setPage(1);
                }}
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
                onChange={(e) => {
                  setSort(e.target.value as ReviewSort);
                  setPage(1);
                }}
                aria-label={tCommon('filter')}
              >
                <option value="newest">{t('sortNewest')}</option>
                <option value="highest">{t('sortHighest')}</option>
                <option value="lowest">{t('sortLowest')}</option>
              </Select>
            </div>
            <span className="ms-auto text-[12.5px] text-faint">
              {t('basedOn', { count: data.total })}
            </span>
          </div>

          {data.rows.length === 0 ? (
            <EmptyState
              icon={<Star className="size-5" />}
              title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
              body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {data.rows.map((review) => (
                <Card key={review.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    {review.score !== null ? (
                      <span
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-[9px] text-[15px] font-bold text-white latn',
                          review.score >= 4
                            ? 'bg-accent'
                            : review.score >= 3
                              ? 'bg-warn'
                              : 'bg-danger',
                        )}
                      >
                        {review.score.toFixed(1)}
                      </span>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">{review.author}</span>
                        {review.country ? (
                          <span className="text-[11.5px] text-faint latn">{review.country}</span>
                        ) : null}
                        {review.score !== null ? (
                          <Chip tone="neutral" className="px-2 py-0 text-[10.5px]">
                            {scoreWord(review.score, t)}
                          </Chip>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
                        {review.date ? (
                          <span className="latn">{formatDate(review.date, locale)}</span>
                        ) : null}
                        {review.roomType ? (
                          <>
                            <span>·</span>
                            <span>{t('stayedIn', { room: review.roomType })}</span>
                          </>
                        ) : null}
                        {!hotelId && review.hotelName ? (
                          <>
                            <span>·</span>
                            <span>{review.hotelName}</span>
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

                  {review.comment ? (
                    <p className="text-[13px] leading-relaxed text-ink">{review.comment}</p>
                  ) : null}

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

                  <ReplyBox hotelId={review.hotelId} review={review} />
                </Card>
              ))}
            </div>
          )}

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {tHotels('prevPage')}
              </Button>
              <span className="text-[12.5px] text-muted latn">
                {page} / {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tHotels('nextPage')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="lg:order-1">
          <BreakdownCard data={data} />
        </div>
      </div>
    </div>
  );
}
