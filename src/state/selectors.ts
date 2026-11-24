import type { Album, Track } from '@shared/types';
import { usePlayer } from './player';

/**
 * 空数组必须是稳定引用：选择器每次返回新数组会让 useSyncExternalStore 判定
 * 快照一直在变，React 直接抛 "getSnapshot should be cached" 并无限重渲染。
 */
export const EMPTY_TRACKS: Track[] = [];
export const EMPTY_ALBUMS: Album[] = [];

export const useLibraryTracks = (): Track[] =>
  usePlayer((state) => state.library?.tracks ?? EMPTY_TRACKS);

export const useLibraryAlbums = (): Album[] =>
  usePlayer((state) => state.library?.albums ?? EMPTY_ALBUMS);
