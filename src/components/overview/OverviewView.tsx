'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Info,
  PercentCircle,
  Plus,
  Star,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button, Card, CardBody, CardHeader, Chip, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { useOverview } from '@/lib/query/hooks';
import { useCatalogLabels } from '@/lib/useLabels';
import type { DashboardAlert } from '@/lib/schemas/booking';
import { cn, formatDateShort, formatMoney, formatNumber } from '@/lib/utils';

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  change,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  change?: number;
}) {
  const t = useTranslations('overview');
  const up = (change ?? 0) >= 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[8px] bg-accent-soft text-accent-ink">
          <Icon className="size-4" />
        </span>
        <span className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-faint">
          {label}
        </span>
      </div>
      <p className="text-[26px] font-bold leading-none tracking-[-.025em] text-ink latn">{value}</p>
      <div className="flex items-center gap-2">
        {change !== undefined && change !== 0 ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[12px] font-semibold latn',
              up ? 'text-ok' : 'text-danger',
            )}
            title={t('vsLastPeriod')}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change)}%
          </span>
        ) : null}
        <span className="text-[11.5px] text-faint">{hint}</span>
      </div>
    </Card>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const t = useTranslations('alerts');
  const Icon =
    alert.severity === 'danger'
      ? TriangleAlert
      : alert.severity === 'warning'
        ? TriangleAlert
        : Info;

  const content = (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-ctl)] border px-3 py-2.5 transition-colors',
        alert.severity === 'danger' && 'border-danger/30 bg-danger-soft',
        alert.severity === 'warning' && 'border-warn/30 bg-warn-soft',
        alert.severity === 'info' && 'border-info/30 bg-info-soft',
        alert.href && 'hover:border-accent',
      )}
    >
      <Icon
        className={cn(
          'mt-px size-4 shrink-0',
          alert.severity === 'danger' && 'text-danger',
          alert.severity === 'warning' && 'text-warn',
          alert.severity === 'info' && 'text-info',
        )}
      />
      <span className="text-[12.5px] font-medium leading-snug text-ink">
        {t(alert.messageKey, alert.params)}
      </span>
    </div>
  );

  return alert.href ? <Link href={alert.href}>{content}</Link> : content;
}

export function OverviewView() {
  const t = useTranslations('overview');
  const tHotels = useTranslations('hotels');
  const tBookings = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const tAlerts = useTranslations('alerts');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const { hotelId } = useHotelScope();
  const { data, isPending, isError } = useOverview(hotelId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[122px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={tCommon('retry')}
        />
      </div>
    );
  }

  const { stats, recentBookings, alerts, accountWide } = data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/pricing">
              <Button>
                <CalendarRange className="size-4" />
                {t('openCalendar')}
              </Button>
            </Link>
            <Link href="/hotels/new">
              <Button variant="primary">
                <Plus className="size-4" />
                {t('addHotel')}
              </Button>
            </Link>
          </div>
        }
      />

      {/* The overview endpoint takes no hotel filter, so a selected hotel
          narrows the alerts but not the numbers. Say which is which. */}
      {accountWide ? (
        <p className="rounded-[var(--radius-ctl)] border border-info/35 bg-info-soft px-3.5 py-2.5 text-[12.5px] text-ink">
          {tAlerts('overviewAccountWide')}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={Building2}
          label={t('kpiActiveHotels')}
          value={formatNumber(stats.activeHotels, locale)}
          hint={t('kpiActiveHotelsHint', { count: stats.draftHotels })}
        />
        <KpiTile
          icon={CalendarCheck}
          label={t('kpiUpcomingCheckIns')}
          value={formatNumber(stats.upcomingCheckIns, locale)}
          hint={t('kpiUpcomingCheckInsHint')}
        />
        <KpiTile
          icon={PercentCircle}
          label={t('kpiOccupancy')}
          value={`${formatNumber(stats.occupancyPercent, locale)}%`}
          hint={t('kpiOccupancyHint')}
          change={stats.occupancyChangePercent}
        />
        <KpiTile
          icon={Wallet}
          label={t('kpiRevenue')}
          value={formatMoney(stats.revenue, stats.revenueCurrency, locale, { compact: true })}
          hint={
            stats.otherCurrencies.length
              ? t('kpiRevenueOther', { currencies: stats.otherCurrencies.join(', ') })
              : t('kpiRevenueHint')
          }
          change={stats.revenueChangePercent}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title={t('recentBookings')}
            action={
              <Link
                href="/bookings"
                className="text-[12.5px] font-semibold text-accent-ink hover:underline"
              >
                {tCommon('viewAll')}
              </Link>
            }
          />
          {recentBookings.length === 0 ? (
            <CardBody>
              <p className="text-[13px] text-muted">{t('recentBookingsEmpty')}</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-[.05em] text-faint">
                    <th className="px-4 py-2.5 text-start font-bold">{tBookings('colGuest')}</th>
                    <th className="px-4 py-2.5 text-start font-bold">{tBookings('colRoom')}</th>
                    <th className="px-4 py-2.5 text-start font-bold">{tBookings('colDates')}</th>
                    <th className="px-4 py-2.5 text-start font-bold">{tBookings('colStatus')}</th>
                    <th className="px-4 py-2.5 text-end font-bold">{tBookings('colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="block font-semibold text-ink">{booking.guestName}</span>
                        <span className="block text-[11.5px] text-faint latn">
                          {booking.reference}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        <span className="flex items-center gap-1.5">
                          <BedDouble className="size-3.5 shrink-0" />
                          {booking.roomTypeName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted latn">
                        {formatDateShort(booking.checkIn, locale)} →{' '}
                        {formatDateShort(booking.checkOut, locale)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Chip tone={booking.tone}>
                          {booking.status
                            ? labels.bookingStatus(booking.status)
                            : booking.statusLabel}
                        </Chip>
                      </td>
                      <td className="px-4 py-2.5 text-end font-semibold text-ink latn">
                        {formatMoney(booking.total ?? undefined, booking.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={t('alerts')} />
            <CardBody className="gap-2">
              {alerts.length === 0 ? (
                <p className="flex items-start gap-2 text-[13px] text-muted">
                  <CheckCircle2 className="mt-px size-4 shrink-0 text-ok" />
                  {t('alertsEmpty')}
                </p>
              ) : (
                alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('quickActions')} />
            <CardBody className="gap-2">
              <Link href="/hotels">
                <Button className="w-full justify-start">
                  <Building2 className="size-4" />
                  {tHotels('title')}
                </Button>
              </Link>
              <Link href="/reviews">
                <Button className="w-full justify-start">
                  <Star className="size-4" />
                  {t('answerReviews')}
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
