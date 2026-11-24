import type {
  HealthResponse,
  LibraryResponse,
  LyricsResponse,
  Track,
  TrackId,
} from '@shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, '无法连接曲库服务，请确认 API 已启动');
  }

  if (!response.ok) {
    throw new ApiError(response.status, `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const coverUrl = (id: TrackId) => `/api/cover/${id}`;
export const streamUrl = (id: TrackId) => `/api/stream/${id}`;

export const api = {
  library: (options: { refresh?: boolean; signal?: AbortSignal } = {}) =>
    request<LibraryResponse>(`/api/library${options.refresh ? '?refresh=1' : ''}`, options.signal),

  lyrics: (id: TrackId, signal?: AbortSignal) =>
    request<LyricsResponse>(`/api/track/${id}/lyrics`, signal),

  track: (id: TrackId, signal?: AbortSignal) =>
    request<{ track: Track }>(`/api/track/${id}`, signal).then((r) => r.track),

  health: (signal?: AbortSignal) => request<HealthResponse>('/api/health', signal),
};
