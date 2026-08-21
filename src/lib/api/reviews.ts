import { z } from 'zod';
import {
  hotelReviewsPageSchema,
  type HotelReviewsPage,
} from '../schemas/hotelApi';
import { request, requestData, USE_MOCK, type Pagination } from './config';

/* ---------------------------------------------------------------------------
 * `GET /api/hotels/{hotelId}/hotel-reviews` and the two reply endpoints.
 *
 * Filtering and sorting are the server's job — `replyStatusId` and `sortId`
 * come from the ReviewReplyStatus and ReviewSortOption lookups. The screen
 * therefore refetches on a filter change rather than re-sorting in the browser,
 * which is what makes paging correct.
 *
 * Note the API is per hotel: there is no endpoint for "every review across my
 * hotels", so the screen requires a hotel to be selected.
 * ------------------------------------------------------------------------- */

export type ReviewsQuery = {
  hotelId: string;
  replyStatusId?: number;
  sortId?: number;
  page?: number;
  limit?: number;
};

export type ReviewsResult = {
  page: HotelReviewsPage;
  pagination: Pagination | null;
};

export const reviewsApi = {
  async list(query: ReviewsQuery): Promise<ReviewsResult> {
    if (USE_MOCK) {
      throw new Error('reviewsApi.list is API-only; the mock path reads reviews off the hotel');
    }
    const { data, pagination } = await requestData(
      `/api/hotels/${query.hotelId}/hotel-reviews`,
      hotelReviewsPageSchema,
      {
        query: {
          replyStatusId: query.replyStatusId,
          sortId: query.sortId,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
        },
      },
    );
    return { page: data, pagination };
  },

  /**
   * Replying and editing a reply are different endpoints; posting a first
   * reply to `reply/edit` (or an edit to `reply`) is the kind of thing the
   * server is entitled to reject, so the caller says which it means.
   */
  async reply(reviewId: string, reply: string, isEdit: boolean): Promise<void> {
    const path = isEdit
      ? `/api/hotels/reviews/${reviewId}/reply/edit`
      : `/api/hotels/reviews/${reviewId}/reply`;
    await request(path, z.unknown(), { method: 'POST', body: { reply } });
  },
};
