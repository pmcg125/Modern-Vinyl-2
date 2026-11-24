import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 渲染期异常兜底：没有它任何一个页面抛错都会白屏。
 * 只包住 <Routes>，这样播放器和播放条在页面崩掉时仍能继续出声。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] 渲染异常:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-[820px] px-4 py-20">
        <div className="mv-panel mv-noise relative p-8">
          <p className="mv-label">RUNTIME ERROR</p>
          <h1 className="mt-2 font-display text-[clamp(34px,7vw,64px)] text-clash-1">
            SIDE&nbsp;BROKEN
          </h1>
          <p className="mt-4 text-[14px] text-muted">
            这个页面在渲染时抛错了，但播放器仍在后台继续出声——问题只影响这一屏。
          </p>
          <pre className="mt-4 overflow-x-auto border-2 border-line bg-bg-2 p-3 font-mono text-[12px] whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="mv-btn" onClick={() => this.setState({ error: null })}>
              重试渲染
            </button>
            <button type="button" className="mv-btn" onClick={() => window.location.assign('/')}>
              回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
}
