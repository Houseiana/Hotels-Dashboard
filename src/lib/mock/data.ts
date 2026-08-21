import type { Hotel } from '../schemas/hotel';
import type { Booking, Settings } from '../schemas/booking';
import { gradientToken } from '../utils';
import { DEFAULT_CURRENCY } from '../catalogs';

/* ---------------------------------------------------------------------------
 * Seed data. Everything here parses cleanly against `hotelSchema`, so the mock
 * layer proves the dashboard's output is guest-app compatible.
 * ------------------------------------------------------------------------- */

export const SEED_HOTELS: Hotel[] = [
  {
    id: 'htl_nile_pearl',
    status: 'active',
    name: 'Nile Pearl Boutique',
    nameAr: 'لؤلؤة النيل بوتيك',
    description:
      'A riverside retreat in Zamalek with marble interiors, three restaurants, a rooftop infinity pool and a full-service spa overlooking the Nile.',
    descriptionAr:
      'ملاذ على ضفاف النيل في الزمالك، بتصميم رخامي وثلاثة مطاعم ومسبح لا متناهٍ على السطح وسبا متكامل يطل على النيل.',
    city: 'cairo',
    country: 'EG',
    address: 'Abu El Feda Street, Zamalek',
    latitude: 30.0626,
    longitude: 31.2197,
    starRating: 5,
    currency: 'EGP',
    coverPhoto: gradientToken(0),
    photos: [gradientToken(0), gradientToken(1), gradientToken(3), gradientToken(4), gradientToken(5)],
    amenities: [
      'wifi', 'pool',
      'gym', 'rooftop',
      'freeParking', 'security',
      'elevator',
    ],
    policies: {
      checkInFrom: '15:00',
      checkOutUntil: '12:00',
      cancellation: 'Free cancellation up to 24 hours before check-in.',
      childrenPolicy: 'Children under 6 stay free in an existing bed. Cots on request.',
      paymentNote: 'Card required at booking; the balance is charged at the property.',
      petsAllowed: false,
      smokingAllowed: false,
    },
    nearby: [
      { name: 'Egyptian Museum', category: 'attraction', distance: '3.1 km' },
      { name: 'Khan El Khalili', category: 'attraction', distance: '6.8 km' },
      { name: 'Cairo Tower', category: 'attraction', distance: '900 m' },
      { name: 'Nile Terrace Seafood', category: 'restaurant', distance: '250 m' },
      { name: 'Lantern Bistro', category: 'restaurant', distance: '600 m' },
      { name: 'Opera Metro Station', category: 'transit', distance: '1.4 km' },
      { name: 'Cairo International Airport', category: 'transit', distance: '22 km' },
    ],
    rating: 4.5,
    reviewCount: 214,
    ratingBreakdown: {
      staff: 4.7,
      cleanliness: 4.5,
      comfort: 4.5,
      location: 4.7,
      facilities: 4.3,
      valueForMoney: 4.0,
      freeWifi: 4.6,
    },
    reviews: [
      {
        id: 'rev_1',
        author: 'Layla H.',
        country: 'AE',
        score: 4.8,
        date: '2026-07-12',
        roomType: 'Deluxe Sea View',
        positive:
          'The sea-view balcony was worth every riyal, and the staff remembered our names by day two.',
        negative: 'Breakfast gets busy around 9am.',
        ownerReply:
          'Thank you Layla — we have added a second buffet line for the morning peak. See you next season!',
      },
      {
        id: 'rev_2',
        author: 'Tom W.',
        country: 'GB',
        score: 4.2,
        date: '2026-07-05',
        roomType: 'Executive Suite',
        positive: 'Spotless suite, superb spa, excellent location for the marina restaurants.',
        negative: 'Air conditioning in the corridor was noisy at night.',
      },
      {
        id: 'rev_3',
        author: 'Noura A.',
        country: 'QA',
        score: 5.0,
        date: '2026-06-28',
        roomType: 'Family Suite',
        positive: 'الغرفة العائلية واسعة والأطفال أحبوا المسبح. خدمة ممتازة.',
      },
      {
        id: 'rev_4',
        author: 'Marc D.',
        country: 'FR',
        score: 3.4,
        date: '2026-06-14',
        roomType: 'Standard Twin',
        positive: 'Good value for the location.',
        negative: 'Our room faced the car park despite booking a city view.',
      },
    ],
    roomTypes: [
      {
        id: 'rt_mm_deluxe',
        name: 'Deluxe Nile View',
        nameAr: 'ديلوكس بإطلالة على النيل',
        description:
          'Spacious 42 m² room with a private balcony over the Nile, king bed and marble bathroom.',
        descriptionAr: 'غرفة واسعة ٤٢ م² بشرفة خاصة تطل على النيل، سرير كينج وحمام رخامي.',
        category: 'deluxe',
        view: 'city',
        capacity: 2,
        beds: 1,
        bedConfig: '1xking',
        bathrooms: 1,
        sizeM2: 42,
        inventory: 24,
        pricePerNight: 8500,
        amenities: ['airConditioning', 'balcony', 'tv'],
        photos: [gradientToken(0), gradientToken(3)],
        refundable: true,
        breakfastIncluded: true,
        ratePlans: [
          {
            id: 'rp_mm_d1',
            name: 'Best flexible rate',
            boardBasis: 'breakfast',
            pricePerNight: 10500,
            refundable: true,
            breakfastIncluded: true,
          },
          {
            id: 'rp_mm_d2',
            name: 'Advance saver',
            boardBasis: 'roomOnly',
            pricePerNight: 8500,
            priceWithoutDiscount: 10000,
            discountPercent: 15,
            refundable: false,
            breakfastIncluded: false,
          },
        ],
      },
      {
        id: 'rt_mm_exec',
        name: 'Executive Suite',
        nameAr: 'جناح تنفيذي',
        description:
          'Two-room suite with a separate lounge, executive floor access and evening canapés.',
        descriptionAr: 'جناح من غرفتين بصالة منفصلة ودخول للطابق التنفيذي وضيافة مسائية.',
        category: 'executiveSuite',
        view: 'city',
        capacity: 3,
        beds: 2,
        bedConfig: '1xking, 1xsofa',
        bathrooms: 2,
        sizeM2: 78,
        inventory: 8,
        pricePerNight: 19000,
        amenities: [
          'airConditioning', 'balcony',
          'coffeeMaker', 'workspace',
        ],
        photos: [gradientToken(1)],
        refundable: true,
        breakfastIncluded: true,
        ratePlans: [
          {
            id: 'rp_mm_e1',
            name: 'Half board',
            boardBasis: 'halfBoard',
            pricePerNight: 19000,
            refundable: true,
            breakfastIncluded: true,
          },
        ],
      },
      {
        id: 'rt_mm_family',
        name: 'Family Suite',
        nameAr: 'جناح عائلي',
        description: 'Connecting rooms sleeping four, with a kitchenette and garden-facing terrace.',
        category: 'family',
        view: 'garden',
        capacity: 4,
        beds: 3,
        bedConfig: '1xking, 2xtwin',
        bathrooms: 2,
        sizeM2: 65,
        inventory: 10,
        pricePerNight: 12900,
        amenities: ['airConditioning', 'kitchen', 'tv'],
        photos: [gradientToken(3)],
        refundable: true,
        breakfastIncluded: true,
        ratePlans: [
          {
            id: 'rp_mm_f1',
            name: 'Family breakfast',
            boardBasis: 'breakfast',
            pricePerNight: 12900,
            refundable: true,
            breakfastIncluded: true,
          },
        ],
      },
      {
        id: 'rt_mm_standard',
        name: 'Standard Twin',
        nameAr: 'غرفة عادية بسريرين',
        description: 'Comfortable 28 m² twin room with a city outlook.',
        category: 'standard',
        view: 'city',
        capacity: 2,
        beds: 2,
        bedConfig: '2xtwin',
        bathrooms: 1,
        sizeM2: 28,
        inventory: 30,
        pricePerNight: 5500,
        amenities: ['airConditioning', 'tv', 'workspace'],
        photos: [gradientToken(2)],
        refundable: false,
        breakfastIncluded: false,
        ratePlans: [
          {
            id: 'rp_mm_s1',
            boardBasis: 'roomOnly',
            pricePerNight: 5500,
            refundable: false,
            breakfastIncluded: false,
          },
          {
            id: 'rp_mm_s2',
            boardBasis: 'breakfast',
            pricePerNight: 6500,
            refundable: true,
            breakfastIncluded: true,
          },
        ],
      },
    ],
  },
  {
    id: 'htl_seaside_grand',
    status: 'active',
    name: 'Seaside Grand Hotel',
    nameAr: 'فندق سيسايد جراند',
    description:
      "Beachfront five-star hotel on Alexandria's Corniche, with sea-view rooms, two restaurants, a rooftop pool and a full-service spa.",
    descriptionAr:
      'فندق خمس نجوم على كورنيش الإسكندرية، بغرف تطل على البحر ومطعمين ومسبح على السطح وسبا متكامل.',
    city: 'alexandria',
    country: 'EG',
    address: '123 El Geish Road, Corniche, Stanley',
    latitude: 31.2454,
    longitude: 29.9668,
    starRating: 5,
    currency: 'EGP',
    coverPhoto: gradientToken(1),
    photos: [gradientToken(1), gradientToken(4), gradientToken(0), gradientToken(2)],
    amenities: [
      'wifi', 'pool',
      'freeParking', 'gym',
      'security', 'elevator',
      'beachAccess', 'washer',
    ],
    policies: {
      checkInFrom: '15:00',
      checkOutUntil: '12:00',
      cancellation: 'Free cancellation up to 48 hours before check-in.',
      childrenPolicy: 'All children are welcome. Extra beds are 250 EGP per night.',
      paymentNote: 'Payment on arrival. Cash and card accepted.',
      petsAllowed: true,
      smokingAllowed: false,
    },
    nearby: [
      { name: 'Seafront Park', category: 'attraction', distance: '900 m' },
      { name: 'Old Town Market', category: 'attraction', distance: '3.2 km' },
      { name: 'Art District', category: 'attraction', distance: '4.8 km' },
      { name: 'Sands Café', category: 'restaurant', distance: '180 m' },
      { name: 'The Golden Spoon', category: 'restaurant', distance: '1.1 km' },
      { name: 'Tram Stop', category: 'transit', distance: '400 m' },
      { name: 'Central Bus Station', category: 'transit', distance: '5.6 km' },
    ],
    rating: 4.1,
    reviewCount: 96,
    ratingBreakdown: {
      staff: 4.3,
      cleanliness: 4.0,
      comfort: 4.2,
      location: 4.5,
      facilities: 4.0,
      valueForMoney: 4.2,
      freeWifi: 3.8,
    },
    reviews: [
      {
        id: 'rev_5',
        author: 'Hassan M.',
        country: 'EG',
        score: 4.4,
        date: '2026-07-18',
        roomType: 'Deluxe Sea View',
        positive: 'إطلالة رائعة على البحر وإفطار متنوع.',
        negative: 'الواي فاي ضعيف في الطوابق العليا.',
      },
      {
        id: 'rev_6',
        author: 'Sofia R.',
        country: 'IT',
        score: 3.7,
        date: '2026-07-02',
        roomType: 'Standard Double',
        positive: 'Great location right on the Corniche, friendly reception.',
        negative: 'The room was smaller than the photos suggested.',
      },
    ],
    roomTypes: [
      {
        id: 'rt_sg_deluxe',
        name: 'Deluxe Sea View',
        nameAr: 'ديلوكس بإطلالة بحرية',
        description:
          'Spacious 32 m² room with a private balcony overlooking the Mediterranean, king bed and marble bathroom.',
        descriptionAr: 'غرفة ٣٢ م² بشرفة خاصة تطل على البحر المتوسط، سرير كينج وحمام رخامي.',
        category: 'deluxe',
        view: 'sea',
        capacity: 2,
        beds: 1,
        bedConfig: '1xking',
        bathrooms: 1,
        sizeM2: 32,
        inventory: 12,
        pricePerNight: 1900,
        amenities: ['airConditioning', 'balcony', 'balcony'],
        photos: [gradientToken(0)],
        refundable: true,
        breakfastIncluded: true,
        ratePlans: [
          {
            id: 'rp_sg_d1',
            boardBasis: 'roomOnly',
            pricePerNight: 1900,
            refundable: false,
            breakfastIncluded: false,
          },
          {
            id: 'rp_sg_d2',
            boardBasis: 'breakfast',
            pricePerNight: 2400,
            refundable: true,
            breakfastIncluded: true,
          },
        ],
      },
      {
        id: 'rt_sg_standard',
        name: 'Standard Double',
        nameAr: 'غرفة عادية مزدوجة',
        description: 'Comfortable 24 m² double room facing the city.',
        category: 'standard',
        view: 'city',
        capacity: 2,
        beds: 1,
        bedConfig: '1xdouble',
        bathrooms: 1,
        sizeM2: 24,
        inventory: 20,
        pricePerNight: 1150,
        amenities: ['airConditioning', 'tv'],
        photos: [gradientToken(2)],
        refundable: false,
        breakfastIncluded: false,
        ratePlans: [
          {
            id: 'rp_sg_s1',
            boardBasis: 'roomOnly',
            pricePerNight: 1150,
            refundable: false,
            breakfastIncluded: false,
          },
        ],
      },
    ],
  },
  {
    id: 'htl_red_sea_towers',
    status: 'draft',
    name: 'Red Sea Skyline Residences',
    nameAr: 'مساكن أفق البحر الأحمر',
    description:
      'Serviced apartment tower in Sahl Hasheesh, minutes from the marina promenade and the dive centres.',
    descriptionAr:
      'برج شقق فندقية في سهل حشيش، على بعد دقائق من ممشى المارينا ومراكز الغوص.',
    city: 'hurghada',
    country: 'EG',
    address: 'Sahl Hasheesh Promenade, Tower 4',
    latitude: 27.2579,
    longitude: 33.8116,
    starRating: 4,
    currency: 'EGP',
    coverPhoto: gradientToken(5),
    photos: [gradientToken(5), gradientToken(2)],
    amenities: ['wifi', 'gym', 'freeParking', 'elevator', 'washer'],
    policies: {
      checkInFrom: '16:00',
      checkOutUntil: '11:00',
      childrenPolicy: 'Children of all ages are welcome.',
      petsAllowed: false,
      smokingAllowed: false,
    },
    nearby: [
      { name: 'Sahl Hasheesh Bay', category: 'attraction', distance: '900 m' },
      { name: 'Cedar Lounge', category: 'restaurant', distance: '350 m' },
      { name: 'Hurghada International Airport', category: 'transit', distance: '18 km' },
    ],
    roomTypes: [
      {
        id: 'rt_lt_studio',
        name: 'Marina Studio',
        nameAr: 'استوديو المارينا',
        category: 'juniorSuite',
        view: 'city',
        capacity: 2,
        beds: 1,
        bedConfig: '1xqueen',
        bathrooms: 1,
        sizeM2: 38,
        inventory: 18,
        pricePerNight: 6300,
        amenities: ['airConditioning', 'kitchen', 'tv', 'workspace'],
        photos: [gradientToken(5)],
        refundable: true,
        breakfastIncluded: false,
        ratePlans: [
          {
            id: 'rp_lt_s1',
            boardBasis: 'roomOnly',
            pricePerNight: 6300,
            refundable: true,
            breakfastIncluded: false,
          },
        ],
      },
      {
        id: 'rt_lt_one_bed',
        name: 'One-Bedroom Apartment',
        nameAr: 'شقة بغرفة نوم واحدة',
        category: 'suite',
        view: 'city',
        capacity: 3,
        beds: 2,
        bedConfig: '1xking, 1xsofa',
        bathrooms: 2,
        sizeM2: 62,
        inventory: 12,
        pricePerNight: 9500,
        amenities: ['airConditioning', 'kitchen', 'workspace'],
        photos: [gradientToken(2)],
        // Deliberately left without rate plans: drives the "needs attention"
        // alert and the wizard's review-step warning in the demo data.
        ratePlans: [],
      },
    ],
  },
];

export const SEED_SETTINGS: Settings = {
  account: {
    companyName: 'Houseiana Hospitality LLC',
    contactEmail: 'owners@houseiana.com',
    contactPhone: '+20 2 2735 1200',
    defaultCurrency: DEFAULT_CURRENCY,
    defaultLocale: 'en',
  },
  payout: {
    method: 'bankTransfer',
    accountName: 'Houseiana Hospitality LLC',
    iban: 'EG380019000500000000263180002',
    bankName: 'Commercial International Bank',
    swift: 'CIBEEGCX',
    payoutCurrency: DEFAULT_CURRENCY,
  },
  defaultPolicies: {
    checkInFrom: '15:00',
    checkOutUntil: '12:00',
    cancellation: 'Free cancellation up to 24 hours before check-in.',
    childrenPolicy: 'Children under 6 stay free in an existing bed.',
    paymentNote: 'Card required at booking; charged at the property.',
    petsAllowed: false,
    smokingAllowed: false,
  },
};

/* -- bookings -------------------------------------------------------------- */

const GUESTS: Array<[string, string, string]> = [
  ['Amira Saleh', 'amira.saleh@example.com', 'QA'],
  ['James Porter', 'j.porter@example.com', 'GB'],
  ['Yusuf Karim', 'y.karim@example.com', 'AE'],
  ['Elena Rossi', 'elena.rossi@example.com', 'IT'],
  ['Fatima Al Naimi', 'f.alnaimi@example.com', 'QA'],
  ['Daniel Brecht', 'd.brecht@example.com', 'DE'],
  ['Sara Haddad', 'sara.h@example.com', 'LB'],
  ['Kenji Watanabe', 'k.watanabe@example.com', 'JP'],
  ['Grace Mwangi', 'g.mwangi@example.com', 'KE'],
  ['Omar Zayed', 'omar.zayed@example.com', 'EG'],
  ['Priya Nair', 'priya.nair@example.com', 'IN'],
  ['Lucas Ferreira', 'l.ferreira@example.com', 'BR'],
];

/**
 * Deterministic PRNG — the mock data must be identical on the server and the
 * client or React hydration would complain about mismatched markup.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export function buildSeedBookings(hotels: Hotel[], today: Date): Booking[] {
  const rand = seededRandom(20260726);
  const statuses = ['confirmed', 'confirmed', 'confirmed', 'pending', 'checkedIn', 'checkedOut', 'cancelled'] as const;
  const bookings: Booking[] = [];
  const bookable = hotels.filter((h) => h.roomTypes.some((rt) => rt.ratePlans.length > 0));

  for (let i = 0; i < 48; i += 1) {
    const hotel = bookable[Math.floor(rand() * bookable.length)];
    const rooms = hotel.roomTypes.filter((rt) => rt.ratePlans.length > 0);
    const room = rooms[Math.floor(rand() * rooms.length)];
    const plan = room.ratePlans[Math.floor(rand() * room.ratePlans.length)];
    const [name, email, country] = GUESTS[Math.floor(rand() * GUESTS.length)];

    // Spread stays from three weeks back to five weeks ahead.
    const offset = Math.floor(rand() * 56) - 21;
    const nights = 1 + Math.floor(rand() * 6);
    const checkIn = new Date(today);
    checkIn.setDate(checkIn.getDate() + offset);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    const created = new Date(checkIn);
    created.setDate(created.getDate() - (3 + Math.floor(rand() * 40)));

    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Past stays resolve to checkedOut/cancelled; future stays stay open.
    const isPast = checkOut < today;
    const status = isPast
      ? rand() < 0.12
        ? 'cancelled'
        : 'checkedOut'
      : checkIn <= today
        ? 'checkedIn'
        : statuses[Math.floor(rand() * 4)];

    bookings.push({
      id: `bkg_${i.toString().padStart(3, '0')}`,
      reference: `HSN-${(10_000 + i * 37).toString()}`,
      hotelId: hotel.id,
      hotelName: hotel.name,
      roomTypeId: room.id,
      roomTypeName: room.name,
      guestName: name,
      guestEmail: email,
      guestCountry: country,
      guests: 1 + Math.floor(rand() * room.capacity),
      checkIn: iso(checkIn),
      checkOut: iso(checkOut),
      nights,
      status,
      boardBasis: plan.boardBasis,
      refundable: plan.refundable,
      total: Math.round(plan.pricePerNight * nights),
      currency: hotel.currency,
      createdAt: iso(created),
      note: rand() < 0.18 ? 'Late arrival, around 23:00.' : undefined,
    });
  }

  return bookings.sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
}
