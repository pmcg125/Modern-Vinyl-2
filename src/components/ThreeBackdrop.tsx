import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { BufferGeometry, LineSegments, WebGLRenderer } from 'three';
import type * as ThreeNS from 'three';
import { usePlayer } from '../state/player';

type Three = typeof ThreeNS;

interface ThreeBackdropProps {
  className?: string;
  style?: CSSProperties;
}

/** 构图参数集中放这里，微调不用翻渲染代码 */
const CORE_RADIUS = 1.65;
const CAGE_RADIUS = 2.5;
const INNER_RADIUS = 1.0;
const STAR_COUNT = 260;

/**
 * Three.js 线框 3D 背景。
 *
 * 只画线：LineSegments + 方形点，跟页面的直角 / 制图语言一致，
 * 实心面会立刻变成廉价的"科技感"渐变球。
 * three 走动态 import，不进首屏包；motion 为 off/calm 时只渲染一张静态构图。
 */
export function ThreeBackdrop({ className, style }: ThreeBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = usePlayer((state) => state.theme);
  const motion = usePlayer((state) => state.motionResolved);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    // 省流/弱网直接不放：three 是装饰性的 187KB(gzip)
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;

    // 等首屏稳定再拉 three：装饰层不该和 LCP 抢带宽
    const start = () => {
      void (async () => {
        let module: Three;
        try {
          module = await import('three');
        } catch {
          return; // 拿不到就干脆不画，背景本来就只是装饰
        }
        if (disposed) return;
        teardown = mount(module, host, motion === 'full');
      })();
    };

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 500);

    return () => {
      disposed = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      teardown?.();
    };
    // 换主题要换线色：直接重建整棵场景最省事，反正切换频率极低
  }, [theme, motion]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={className}
      style={{ pointerEvents: 'none', ...style }}
    />
  );
}

/** 固定种子的伪随机：每次进页面星点分布一致，换主题不该把星空洗牌 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mount(THREE: Three, host: HTMLElement, animate: boolean): (() => void) | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return null; // 没有 WebGL / 上下文被占满：静默降级成普通背景
  }

  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 0, 7.4);

  const group = new THREE.Group();
  scene.add(group);

  const lineMaterial = (color: string, opacity: number) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  const wire = (geometry: BufferGeometry, color: string, opacity: number): LineSegments => {
    const edges = new THREE.EdgesGeometry(geometry);
    geometry.dispose();
    return new THREE.LineSegments(edges, lineMaterial(color, opacity));
  };

  // 核心多面体 + 反向漂移的外笼 + 内核，三层转速不同才有纵深
  const core = wire(
    new THREE.IcosahedronGeometry(CORE_RADIUS, 1),
    token('--accent', '#00ff6a'),
    0.6,
  );
  const cage = wire(
    new THREE.DodecahedronGeometry(CAGE_RADIUS, 0),
    token('--clash-1', '#ff2e93'),
    0.24,
  );
  const inner = wire(
    new THREE.OctahedronGeometry(INNER_RADIUS, 0),
    token('--clash-2', '#d7ff00'),
    0.5,
  );
  group.add(core, cage, inner);

  const random = mulberry32(20261024);
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // 贴着外笼的一层"轨道尘埃"：再远就会被取景裁掉，只剩中间一小撮
    const radius = 2.65 + random() * 0.85;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    // 纵向压扁：hero 是宽扁的，圆球状点云会顶到上下边
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.78;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: token('--ink', '#e6ffee'),
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  group.add(stars);

  renderer.setClearAlpha(0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // 透视相机只有纵向视场角：只按高度定距离的话，宽屏上图形会缩成一点、
    // 竖长 hero 上又会被左右切掉。按较短的那一边取景才稳定。
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fitRadius = CAGE_RADIUS * 1.12;
    camera.position.z = Math.min(24, fitRadius / Math.sin(Math.min(vFov, hFov) / 2));
    camera.updateProjectionMatrix();

    if (!animate) renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // 指针视差：画布本身不接收事件，所以在 window 上听
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const onPointerMove = (event: PointerEvent) => {
    pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (animate) window.addEventListener('pointermove', onPointerMove, { passive: true });

  let frame = 0;
  let last = performance.now();
  let clock = 0;

  const paint = (now: number) => {
    frame = requestAnimationFrame(paint);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;

    const ease = Math.min(1, dt * 4);
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;

    group.rotation.y += dt * 0.16;
    group.rotation.x = Math.sin(clock * 0.22) * 0.13 + pointer.y * 0.2;
    group.position.y = Math.sin(clock * 0.5) * 0.06;
    group.position.x = pointer.x * 0.16;

    core.rotation.y += dt * 0.42;
    inner.rotation.z -= dt * 0.5;
    inner.rotation.x += dt * 0.24;
    cage.rotation.y -= dt * 0.09;
    stars.rotation.y += dt * 0.03;

    renderer.render(scene, camera);
  };

  if (animate) {
    last = performance.now();
    frame = requestAnimationFrame(paint);
  } else {
    // 静态档：给个好看的固定角度，只渲一帧
    group.rotation.set(0.22, 0.55, 0);
    core.rotation.set(0.1, 0.3, 0);
    inner.rotation.set(0.3, 0.2, 0.1);
  }
  resize();

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (animate && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(paint);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);

    for (const object of [core, cage, inner, stars]) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
