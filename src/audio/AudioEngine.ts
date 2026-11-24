import type { EqState } from '../lib/storage';
import { downsampleWaveform } from '../lib/audioMath';

export interface EngineEvents {
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onTime: (positionSec: number) => void;
  onLoaded: (durationSec: number) => void;
  onError: (message: string) => void;
}

interface EqGraph {
  analyser: AnalyserNode;
  filters: { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode };
}

const EQ_BANDS = { low: 320, mid: 1000, high: 3000 } as const;

export type MediaSessionHandlers = Partial<
  Record<MediaSessionAction, (details: MediaSessionActionDetails) => void>
>;

/**
 * 单一 <audio> 元素 + WebAudio 处理链（source -> low -> mid -> high -> analyser -> destination）。
 *
 * 图在首次 play() 时（即用户手势内）才创建：提前创建 AudioContext 会被浏览器挂起，
 * 而 createMediaElementSource 只能对一个元素调用一次，所以这里刻意保持幂等。
 * 建图失败时只牺牲 EQ/频谱，播放本身不受影响。
 */
export class AudioEngine {
  readonly element: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private graph: EqGraph | null = null;
  private spectrum: Uint8Array<ArrayBuffer> | null = null;
  private wave: Uint8Array<ArrayBuffer> | null = null;
  private eq: EqState = { low: 0, mid: 0, high: 0 };
  private volume = 0.8;
  private muted = false;

  constructor(private readonly events: EngineEvents) {
    this.element = new Audio();
    this.element.preload = 'metadata';
    this.element.volume = this.volume;

    this.element.addEventListener('play', events.onPlay);
    this.element.addEventListener('playing', events.onPlay);
    this.element.addEventListener('pause', events.onPause);
    this.element.addEventListener('ended', events.onEnded);
    this.element.addEventListener('timeupdate', () => events.onTime(this.element.currentTime));
    this.element.addEventListener('loadedmetadata', () =>
      events.onLoaded(this.element.duration || 0),
    );
    this.element.addEventListener('error', () => {
      if (!this.element.currentSrc) return;
      events.onError('音频解码失败或网络中断');
    });
  }

  private ensureGraph(): void {
    if (this.graph || this.ctx) return;

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(this.element);

      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = EQ_BANDS.low;

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = EQ_BANDS.mid;
      mid.Q.value = 0.9;

      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = EQ_BANDS.high;

      const analyser = ctx.createAnalyser();
      // 512 个频点要喂 60+ 根对数柱，低频区一根柱子摊不满一个频点，
      // 相邻列只能取到同一个值 —— 频谱就会黏成块。2048 让 32Hz 附近也有分辨率。
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      // 默认窗口是 -100..-30dB：流行母带的绝大多数频点都在 -30dB 以上，
      // 于是 getByteFrequencyData 全被顶到 255，频谱画出来是一块平顶砖。
      // 把上限抬到 -15dB，能量差异才看得见。
      analyser.minDecibels = -90;
      analyser.maxDecibels = -15;

      source.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(analyser);
      analyser.connect(ctx.destination);

      low.gain.value = this.eq.low;
      mid.gain.value = this.eq.mid;
      high.gain.value = this.eq.high;

      this.ctx = ctx;
      this.graph = { analyser, filters: { low, mid, high } };
      this.spectrum = new Uint8Array(analyser.frequencyBinCount);
      this.wave = new Uint8Array(analyser.fftSize);
    } catch (err) {
      console.warn('[engine] WebAudio 图创建失败，EQ 与频谱不可用', err);
      this.ctx = null;
      this.graph = null;
    }
  }

  get url(): string {
    return this.element.currentSrc || this.element.src;
  }

  get currentTime(): number {
    return this.element.currentTime;
  }

  get duration(): number {
    return Number.isFinite(this.element.duration) ? this.element.duration : 0;
  }

  /** 频点数：建图前未知，按 fftSize 2048 的一半兜底 */
  get spectrumBinCount(): number {
    return this.spectrum?.length ?? 1024;
  }

  /**
   * 分析器实际工作的采样率。
   * AudioContext 会把媒体重采样到它自己的速率，用文件标签里的数字算频点会整体偏移，
   * 频谱的高频端和 CUT 边界都会跟着错。
   */
  get analyserSampleRate(): number {
    return this.ctx?.sampleRate || 44100;
  }

  /** 元素上是否已经挂了音源：恢复会话后第一次播放要靠它判断需要重新装载 */
  get hasSource(): boolean {
    return Boolean(this.element.currentSrc || this.element.src);
  }

  /** 已缓冲到全曲的比例，进度条用它画「预读」段 */
  get bufferedRatio(): number {
    const { buffered, duration } = this.element;
    if (!duration || !buffered.length) return 0;
    const end = buffered.end(buffered.length - 1);
    return Number.isFinite(end) ? Math.min(1, end / duration) : 0;
  }

  /** 载入并播放；startAt 用于从上次进度接续 */
  async playTrack(url: string, options: { startAt?: number } = {}): Promise<void> {
    this.ensureGraph();
    await this.resumeContext();

    const absolute = new URL(url, location.href).href;
    if (this.element.src !== absolute) {
      this.element.src = absolute;
      this.element.load();
    }

    const startAt = options.startAt ?? 0;
    if (startAt > 0) {
      // 刚 load() 完 duration 还是 NaN，得等 metadata 才能定位
      if (!Number.isFinite(this.element.duration) || this.element.duration <= 0) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 1500);
          this.element.addEventListener(
            'loadedmetadata',
            () => {
              window.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
      if (Number.isFinite(this.element.duration) && this.element.duration > 0) {
        this.element.currentTime = Math.min(startAt, this.element.duration - 0.5);
      }
    }

    await this.element.play();
  }

  async play(): Promise<void> {
    // 只建图不够：上下文若处于 suspended，媒体会被喂进一个不推进的图，
    // 表现为 currentTime 卡在 0、频谱全零
    this.ensureGraph();
    await this.resumeContext();
    await this.element.play();
  }

  pause(): void {
    this.element.pause();
  }

  seek(seconds: number): void {
    if (!this.hasSource) return;
    const target = Math.max(0, seconds);
    this.element.currentTime = target;
    this.events.onTime(target);
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    this.element.volume = this.muted ? 0 : this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.element.volume = muted ? 0 : this.volume;
  }

  setEq(eq: EqState): void {
    this.eq = eq;
    if (!this.graph) return;
    this.graph.filters.low.gain.value = eq.low;
    this.graph.filters.mid.gain.value = eq.mid;
    this.graph.filters.high.gain.value = eq.high;
  }

  /**
   * 原始频点数组（长度 = frequencyBinCount）。
   * 不在这里分桶：怎么压成柱子是显示层的事，交给 adaptiveBands 按对数频带插值。
   * 未建图时返回 null，调用方应回落到静态占位。
   */
  readSpectrum(): Uint8Array<ArrayBuffer> | null {
    if (!this.graph?.analyser || !this.spectrum) return null;
    this.graph.analyser.getByteFrequencyData(this.spectrum);
    return this.spectrum;
  }

  /** 时域波形，供示波器视图使用；未建图时返回 null */
  readWaveform(samples: number): Float32Array | null {
    if (!this.graph?.analyser || !this.wave) return null;
    this.graph.analyser.getByteTimeDomainData(this.wave);
    return downsampleWaveform(this.wave, samples);
  }

  private async resumeContext(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume().catch(() => undefined);
    }
  }

  /** 锁屏/系统播放中心的进度条 */
  setPositionState(position: number, duration: number): void {
    if (!('mediaSession' in navigator) || !(duration > 0)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(position, duration),
        playbackRate: 1,
      });
    } catch {
      /* 部分浏览器不支持 position state */
    }
  }

  /** OS 媒体键/系统Now Playing 需要页面自己写 metadata */
  setMediaSession(meta: MediaMetadataInit | null, handlers: MediaSessionHandlers = {}): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = meta ? new MediaMetadata(meta) : null;

    for (const [action, handler] of Object.entries(handlers) as [
      MediaSessionAction,
      (() => void) | undefined,
    ][]) {
      if (!handler) continue;
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* 该浏览器不支持这个 action */
      }
    }
  }
}
