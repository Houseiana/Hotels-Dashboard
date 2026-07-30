import { settingsSchema, type Settings } from '../schemas/booking';
import { request, USE_MOCK } from './config';
import * as mock from '../mock/db';

export const settingsApi = {
  get(): Promise<Settings> {
    return USE_MOCK ? mock.getSettings() : request('/settings', settingsSchema);
  },

  save(settings: Settings): Promise<Settings> {
    if (USE_MOCK) return mock.saveSettings(settings);
    return request('/settings', settingsSchema, { method: 'PUT', body: settings });
  },
};
