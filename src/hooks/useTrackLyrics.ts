import { useCallback, useEffect, useState } from 'react';
import type { LyricsResponse } from '@shared/types';
import { api } from '../lib/api';

export interface TrackLyrics {
  data: LyricsResponse | null;
  loading: boolean;
  error: string | null;
  /** 重新拉一次：网络抖动或刚往 music/ 补了 .lrc 时用 */
  retry: () => void;
}

/**
 * 按曲目取歌词。
 *
 * 失败必须落到可见的状态：之前只 .then 不 .catch，请求一挂就永远停在
 * 「READING TAGS」的闪烁光标上，看起来像功能没做。
 */
export function useTrackLyrics(trackId: string | undefined): TrackLyrics {
  const [data, setData] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(trackId));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!trackId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);

    api
      .lyrics(trackId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackId, attempt]);

  return { data, loading, error, retry };
}
