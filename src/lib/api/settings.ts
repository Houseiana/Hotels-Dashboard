import { z } from 'zod';
import type { Settings } from '../schemas/booking';
import type { HotelPolicies } from '../schemas/hotel';
import {
  managerAccountSchema,
  payoutMethodRecordSchema,
  type PayoutMethodRecord,
} from '../schemas/hotelApi';
import { request, requestData, USE_MOCK } from './config';
import * as mock from '../mock/db';
import { DEFAULT_CURRENCY } from '../catalogs';

/* ---------------------------------------------------------------------------
 * `GET/POST /api/hotels/account` and the payout-method endpoints.
 *
 * Two of this screen's fields have no home on the server: the dashboard's
 * display language and the default check-in/out times used to seed new hotels.
 * Both are preferences of this browser rather than account data, so they are
 * stored locally and merged in here — the alternative is showing fields that
 * silently forget what you typed.
 *
 * Payout methods are a LIST on the server with their own create, edit and
 * delete calls, so they are NOT part of `save()`; the screen manages them one
 * at a time through `payoutApi`.
 * ------------------------------------------------------------------------- */

const LOCAL_KEY = 'houseiana.settings.local';

type LocalPreferences = {
  defaultLocale: 'en' | 'ar';
  defaultPolicies: HotelPolicies;
};

const localSchema = z.object({
  defaultLocale: z.enum(['en', 'ar']),
  defaultPolicies: z.object({
    checkInFrom: z.string().optional(),
    checkOutUntil: z.string().optional(),
    cancellationPolicy: z.string().optional(),
    childrenAllowed: z.boolean().optional(),
    petsAllowed: z.boolean().optional(),
    smokingAllowed: z.boolean().optional(),
  }),
});

const FALLBACK: LocalPreferences = {
  defaultLocale: 'en',
  defaultPolicies: { checkInFrom: '15:00', checkOutUntil: '12:00' },
};

function readLocal(): LocalPreferences {
  if (typeof window === 'undefined') return FALLBACK;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return FALLBACK;
    const parsed = localSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as LocalPreferences) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function writeLocal(preferences: LocalPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(preferences));
  } catch {
    // A full or blocked store is not worth failing a save over.
  }
}

export const settingsApi = {
  async get(): Promise<Settings> {
    if (USE_MOCK) return mock.getSettings();

    const { data } = await requestData('/api/hotels/account', managerAccountSchema);
    const local = readLocal();

    return {
      account: {
        companyName: data.name ?? '',
        contactEmail: data.contactEmail ?? '',
        contactPhone: data.contactPhone ?? undefined,
        defaultCurrency: data.currencyCode || DEFAULT_CURRENCY,
        defaultLocale: local.defaultLocale,
      },
      // Unused in API mode; the payout tab reads `payoutApi.list()`.
      payout: {
        method: 'bankTransfer',
        accountName: '',
        iban: '',
        payoutCurrency: data.currencyCode || DEFAULT_CURRENCY,
      },
      defaultPolicies: local.defaultPolicies,
    };
  },

  /**
   * Saves the account to the server and the two browser-only preferences
   * locally. `currencyId` is resolved by the caller from the Currencies lookup,
   * because the account endpoint takes the id while the dashboard speaks codes.
   */
  async save(settings: Settings, currencyId: number | undefined): Promise<Settings> {
    if (USE_MOCK) return mock.saveSettings(settings);

    await request('/api/hotels/account/edit', z.unknown(), {
      method: 'POST',
      body: {
        name: settings.account.companyName,
        contactEmail: settings.account.contactEmail,
        contactPhone: settings.account.contactPhone ?? null,
        currencyId,
      },
    });

    writeLocal({
      defaultLocale: settings.account.defaultLocale,
      defaultPolicies: settings.defaultPolicies,
    });

    return settings;
  },
};

export type PayoutMethodInput = {
  payoutMethodId: number;
  accountId: string;
  accountName: string;
};

export const payoutApi = {
  async list(): Promise<PayoutMethodRecord[]> {
    if (USE_MOCK) return [];
    const { data } = await requestData(
      '/api/hotels/account/payout-methods',
      z.array(payoutMethodRecordSchema),
    );
    return data;
  },

  async create(input: PayoutMethodInput): Promise<void> {
    await request('/api/hotels/account/payout-method/create', z.unknown(), {
      method: 'POST',
      body: input,
    });
  },

  async update(id: string, input: PayoutMethodInput): Promise<void> {
    await request(`/api/hotels/account/payout-method/${id}/edit`, z.unknown(), {
      method: 'POST',
      body: input,
    });
  },

  async remove(id: string): Promise<void> {
    await request(`/api/hotels/account/payout-method/${id}/delete`, z.unknown(), {
      method: 'POST',
    });
  },
};
