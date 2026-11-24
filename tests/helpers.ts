import type { Track } from '@shared/types';

let seq = 0;

export function makeTrack(overrides: Partial<Track> = {}): Track {
  seq += 1;
  return {
    id: `id-${seq}`,
    title: `Track ${seq}`,
    artist: 'Artist A',
    albumArtist: 'Artist A',
    album: 'Album One',
    year: 2020,
    genre: 'Electronic',
    trackNo: seq,
    durationSec: 180,
    filename: `track-${seq}.mp3`,
    bytes: 5_000_000,
    bitrateKbps: 320,
    sampleRateHz: 44100,
    codec: 'MPEG 1 Layer 3',
    hasCover: true,
    lyricSource: 'none',
    mtimeMs: 1_700_000_000_000 + seq * 1000,
    ...overrides,
  };
}
