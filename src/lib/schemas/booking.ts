import { z } from 'zod';
import { hotelPoliciesSchema } from './hotel';

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'checkedIn',
  'checkedOut',
  'cancelled',
]);

export const bookingSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  hotelId: z.string().min(1),
  hotelName: z.string().min(1),
  roomTypeId: z.string().min(1),
  roomTypeName: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestCountry: z.string().optional(),
  guests: z.number().int().min(1),
  /** ISO yyyy-mm-dd */
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  nights: z.number().int().min(1),
  status: bookingStatusSchema,
  boardBasis: z.string().optional(),
  refundable: z.boolean().optional(),
  total: z.number().min(0),
  currency: z.string().length(3),
  createdAt: z.string().min(1),
  note: z.string().optional(),
});

export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type Booking = z.infer<typeof bookingSchema>;

/* -- pricing & availability ------------------------------------------------ */

export const dayInventorySchema = z.object({
  /** ISO yyyy-mm-dd */
  date: z.string().min(1),
  price: z.number().positive('pricePositive'),
  priceWithoutDiscount: z.number().positive('pricePositive').optional(),
  discountPercent: z.number().min(0).max(100, 'discountRange').optional(),
  sold: z.number().int().min(0),
  blocked: z.number().int().min(0),
  closed: z.boolean().optional(),
  minStay: z.number().int().min(1).optional(),
  /** True when this night's price overrides the rate plan's base price. */
  isSpecialPrice: z.boolean().optional(),
});

/** A rate plan the calendar can be priced against. */
export const calendarRatePlanSchema = z.object({
  id: z.string().min(1),
  boardBasis: z.string().optional(),
  basePrice: z.number().optional(),
});

export const availabilityCalendarSchema = z.object({
  hotelId: z.string().min(1),
  roomTypeId: z.string().min(1),
  totalUnits: z.number().int().min(0),
  currency: z.string().length(3),
  /**
   * Prices belong to a rate plan, not to the room type, so the calendar is
   * always showing ONE plan's nightly rates. Empty in the mock, which prices
   * the room type directly.
   */
  ratePlans: z.array(calendarRatePlanSchema).default([]),
  days: z.array(dayInventorySchema),
});

export type DayInventory = z.infer<typeof dayInventorySchema>;
export type CalendarRatePlan = z.infer<typeof calendarRatePlanSchema>;
export type AvailabilityCalendar = z.infer<typeof availabilityCalendarSchema>;

/** Payload for the bulk editor: apply a change to a date range. */
export const bulkRateUpdateSchema = z
  .object({
    hotelId: z.string().min(1),
    roomTypeId: z.string().min(1),
    from: z.string().min(1, 'dateRequired'),
    to: z.string().min(1, 'dateRequired'),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    price: z.number().positive('pricePositive').optional(),
    priceWithoutDiscount: z.number().positive('pricePositive').optional(),
    discountPercent: z.number().min(0).max(100, 'discountRange').optional(),
    blocked: z.number().int().min(0).optional(),
    closed: z.boolean().optional(),
    minStay: z.number().int().min(1).optional(),
  })
  .refine((v) => v.from <= v.to, { message: 'dateRangeOrder', path: ['to'] })
  .refine(
    (v) =>
      v.price !== undefined ||
      v.priceWithoutDiscount !== undefined ||
      v.discountPercent !== undefined ||
      v.blocked !== undefined ||
      v.closed !== undefined ||
      v.minStay !== undefined,
    { message: 'nothingToApply', path: ['price'] },
  );

export type BulkRateUpdate = z.infer<typeof bulkRateUpdateSchema>;

/* -- settings -------------------------------------------------------------- */

export const payoutSettingsSchema = z.object({
  method: z.enum(['bankTransfer', 'wise', 'paypal']),
  accountName: z.string().min(1, 'accountNameRequired'),
  iban: z.string().min(1, 'ibanRequired'),
  bankName: z.string().optional(),
  swift: z.string().optional(),
  payoutCurrency: z.string().length(3, 'currencyRequired'),
});

export const accountSettingsSchema = z.object({
  companyName: z.string().min(1, 'companyNameRequired'),
  contactEmail: z.string().email('emailInvalid'),
  contactPhone: z.string().optional(),
  defaultCurrency: z.string().length(3, 'currencyRequired'),
  defaultLocale: z.enum(['en', 'ar']),
});

export const settingsSchema = z.object({
  account: accountSettingsSchema,
  /**
   * Kept for the mock store only. The API models payouts as a LIST managed
   * through its own create/edit/delete endpoints, so the real screen reads
   * `usePayoutMethods` rather than this field.
   */
  payout: payoutSettingsSchema,
  defaultPolicies: hotelPoliciesSchema,
});

export type PayoutSettings = z.infer<typeof payoutSettingsSchema>;
export type AccountSettings = z.infer<typeof accountSettingsSchema>;
export type Settings = z.infer<typeof settingsSchema>;

/* -- overview -------------------------------------------------------------- */

export const overviewStatsSchema = z.object({
  activeHotels: z.number().int().min(0),
  draftHotels: z.number().int().min(0),
  upcomingCheckIns: z.number().int().min(0),
  occupancyPercent: z.number().min(0).max(100),
  revenue: z.number().min(0),
  revenueCurrency: z.string().length(3),
  /** Currencies present in scope but excluded from `revenue` (no FX available). */
  otherCurrencies: z.array(z.string().length(3)).default([]),
  /**
   * Optional because `GET /api/hotels/overview` reports current figures with no
   * prior period to compare against. The tiles hide the delta chip rather than
   * showing a trend nobody measured.
   */
  revenueChangePercent: z.number().optional(),
  occupancyChangePercent: z.number().optional(),
});

export const alertSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['info', 'warning', 'danger']),
  /** i18n key under `alerts.*`, rendered with `params`. */
  messageKey: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  href: z.string().optional(),
});

export type OverviewStats = z.infer<typeof overviewStatsSchema>;
export type DashboardAlert = z.infer<typeof alertSchema>;
