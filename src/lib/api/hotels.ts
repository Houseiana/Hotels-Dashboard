import { z } from 'zod';
import { hotelSchema, hotelReviewSchema, type Hotel, type HotelReview } from '../schemas/hotel';
import { request, USE_MOCK } from './config';
import * as mock from '../mock/db';
import { lookupNearbyPlaces } from '../mock/places';
import { hotelNearbyPlaceSchema, type HotelNearbyPlace } from '../schemas/hotel';

const hotelListSchema = z.array(hotelSchema);
const nearbyListSchema = z.array(hotelNearbyPlaceSchema);

export const hotelsApi = {
  list(): Promise<Hotel[]> {
    return USE_MOCK ? mock.listHotels() : request('/hotels', hotelListSchema);
  },

  get(id: string): Promise<Hotel> {
    return USE_MOCK ? mock.getHotel(id) : request(`/hotels/${id}`, hotelSchema);
  },

  save(hotel: Hotel): Promise<Hotel> {
    if (USE_MOCK) return mock.saveHotel(hotel);
    return request(`/hotels/${hotel.id}`, hotelSchema, {
      method: 'PUT',
      body: hotel,
    });
  },

  remove(id: string): Promise<void> {
    if (USE_MOCK) return mock.deleteHotel(id);
    return request(`/hotels/${id}`, z.void(), { method: 'DELETE' });
  },

  setStatus(id: string, status: Hotel['status']): Promise<Hotel> {
    if (USE_MOCK) return mock.setHotelStatus(id, status);
    return request(`/hotels/${id}/status`, hotelSchema, {
      method: 'PATCH',
      body: { status },
    });
  },

  replyToReview(hotelId: string, reviewId: string, reply: string): Promise<HotelReview> {
    if (USE_MOCK) return mock.replyToReview(hotelId, reviewId, reply);
    return request(`/hotels/${hotelId}/reviews/${reviewId}/reply`, hotelReviewSchema, {
      method: 'PUT',
      body: { ownerReply: reply },
    });
  },

  /**
   * `nearby[]` is derived from the pin, never entered by hand. Behind a real
   * backend this proxies a Places provider so the guest app and the dashboard
   * agree on what "nearby" means.
   */
  nearby(latitude: number, longitude: number, locale: string): Promise<HotelNearbyPlace[]> {
    if (USE_MOCK) return lookupNearbyPlaces(latitude, longitude, locale);
    return request('/places/nearby', nearbyListSchema, {
      query: { lat: latitude, lng: longitude, locale },
    });
  },
};
