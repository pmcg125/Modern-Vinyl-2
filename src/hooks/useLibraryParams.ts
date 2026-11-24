import { useSearchParams } from 'react-router-dom';
import type { SortKey } from '../lib/filters';

export interface LibraryQueryState {
  text: string;
  artist: string | null;
  sort: SortKey;
  desc: boolean;
}

/**
 * 曲库筛选状态全部落在 URL 上：/library?q=花&a=Mai 可分享、可前进后退，
 * 组件卸载再回来也不会丢状态。
 */
export function useLibraryParams() {
  const [params, setParams] = useSearchParams();

  const query: LibraryQueryState = {
    text: params.get('q') ?? '',
    artist: params.get('a'),
    sort: (params.get('sort') as SortKey) ?? 'title',
    desc: params.get('dir') === 'desc',
  };

  const update = (patch: Partial<Pick<LibraryQueryState, 'text' | 'artist' | 'sort' | 'desc'>>) => {
    const merged = { ...query, ...patch };
    const next = new URLSearchParams(params);

    if (merged.text) next.set('q', merged.text);
    else next.delete('q');

    if (merged.artist) next.set('a', merged.artist);
    else next.delete('a');

    if (merged.sort !== 'title') next.set('sort', merged.sort);
    else next.delete('sort');

    if (merged.desc) next.set('dir', 'desc');
    else next.delete('dir');

    setParams(next, { replace: true });
  };

  const reset = () => setParams(new URLSearchParams(), { replace: true });

  return { query, update, reset };
}
