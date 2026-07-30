import type { HotelNearbyPlace } from '../schemas/hotel';
import { seededRandom } from './data';

/* ---------------------------------------------------------------------------
 * Mock places lookup.
 *
 * `nearby[]` is never typed in by the owner — it is derived from the map pin.
 * Swapping this for a real Places API means replacing `lookupNearbyPlaces`
 * only; the wizard already treats the result as read-only.
 * ------------------------------------------------------------------------- */

type PlaceSeed = { en: string; ar: string };

const ATTRACTIONS: PlaceSeed[] = [
  { en: 'Museum of Islamic Art', ar: 'متحف الفن الإسلامي' },
  { en: 'Souq Waqif', ar: 'سوق واقف' },
  { en: 'Corniche Promenade', ar: 'ممشى الكورنيش' },
  { en: 'The Pearl', ar: 'اللؤلؤة' },
  { en: 'National Museum', ar: 'المتحف الوطني' },
  { en: 'Grand Mosque', ar: 'المسجد الكبير' },
  { en: 'Old Town Market', ar: 'سوق المدينة القديمة' },
  { en: 'Seafront Park', ar: 'حديقة الواجهة البحرية' },
  { en: 'Art District', ar: 'حي الفنون' },
];

const RESTAURANTS: PlaceSeed[] = [
  { en: 'Al Mourad Grill', ar: 'مطعم المراد جريل' },
  { en: 'Lantern Bistro', ar: 'بيسترو الفانوس' },
  { en: 'Harbour Seafood', ar: 'مأكولات الميناء البحرية' },
  { en: 'Cedar Lounge', ar: 'صالة الأرز' },
  { en: 'Sands Café', ar: 'مقهى الرمال' },
  { en: 'The Golden Spoon', ar: 'الملعقة الذهبية' },
  { en: 'Spice Market', ar: 'سوق التوابل' },
];

const TRANSIT: PlaceSeed[] = [
  { en: 'Metro Station', ar: 'محطة المترو' },
  { en: 'Central Bus Station', ar: 'محطة الحافلات المركزية' },
  { en: 'International Airport', ar: 'المطار الدولي' },
  { en: 'Ferry Terminal', ar: 'محطة العبّارات' },
  { en: 'Tram Stop', ar: 'محطة الترام' },
];

function formatDistance(metres: number, locale: string): string {
  const digits = (n: number) => (locale === 'ar' ? n.toLocaleString('ar-EG') : String(n));
  if (metres < 1000) return locale === 'ar' ? `${digits(metres)} م` : `${metres} m`;
  const km = Math.round(metres / 100) / 10;
  return locale === 'ar' ? `${km.toLocaleString('ar-EG')} كم` : `${km} km`;
}

function pick(
  pool: PlaceSeed[],
  count: number,
  category: HotelNearbyPlace['category'],
  rand: () => number,
  locale: string,
  maxMetres: number,
): HotelNearbyPlace[] {
  const remaining = [...pool];
  const picked: HotelNearbyPlace[] = [];

  for (let i = 0; i < count && remaining.length > 0; i += 1) {
    const seed = remaining.splice(Math.floor(rand() * remaining.length), 1)[0];
    const metres =
      Math.round((120 + rand() * maxMetres) / (maxMetres > 5000 ? 100 : 10)) *
      (maxMetres > 5000 ? 100 : 10);
    picked.push({
      name: locale === 'ar' ? seed.ar : seed.en,
      category,
      distance: formatDistance(metres, locale),
    });
  }

  return picked.sort((a, b) => a.distance.localeCompare(b.distance, 'en', { numeric: true }));
}

/**
 * Deterministic per pin: the same coordinates always yield the same places, so
 * nudging the pin back and forth doesn't reshuffle the list under the owner.
 */
export async function lookupNearbyPlaces(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<HotelNearbyPlace[]> {
  await new Promise((resolve) => setTimeout(resolve, 420));

  const seed =
    Math.abs(Math.round(latitude * 1000)) * 7919 +
    Math.abs(Math.round(longitude * 1000)) * 104_729;
  const rand = seededRandom(seed || 1);

  return [
    ...pick(ATTRACTIONS, 3, 'attraction', rand, locale, 9000),
    ...pick(RESTAURANTS, 3, 'restaurant', rand, locale, 1800),
    ...pick(TRANSIT, 2, 'transit', rand, locale, 12_000),
  ];
}
