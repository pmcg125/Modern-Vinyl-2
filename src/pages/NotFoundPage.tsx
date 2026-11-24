import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-center justify-center px-4 py-20 text-center">
      <p className="mv-label mb-3">ROUTE ERROR 404</p>
      <h1 className="font-display text-[clamp(60px,18vw,150px)] leading-[0.8]">
        <span className="block bg-clash-1 px-3 text-white">SIDE</span>
        <span className="block px-3">B?</span>
      </h1>
      <p className="mt-6 font-mono text-[12px] tracking-widest text-muted uppercase">
        这条路由上没有唱片
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link to="/" className="mv-btn">
          回首页
        </Link>
        <Link to="/library" className="mv-btn">
          曲库
        </Link>
        <Link to="/now" className="mv-btn">
          沉浸播放器
        </Link>
      </div>
    </div>
  );
}
