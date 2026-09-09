import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, Maximize2, Minus, Plus, X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

type ImageDimensions = { width: number; height: number };

const clampZoom = (value: number) => Math.min(4, Math.max(0.25, value));

const getViewport = () => ({
  width: typeof window === 'undefined' ? 1280 : window.innerWidth,
  height: typeof window === 'undefined' ? 800 : window.innerHeight,
});

/**
 * 图片阅读器保持画布极简：图片本身是视觉主体，控制项只在边缘和底部悬浮出现。
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [viewport, setViewport] = useState(getViewport);
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);

  const fitted = useMemo(() => {
    if (!dimensions) return null;
    const availableWidth = Math.max(1, viewport.width - 32);
    const availableHeight = Math.max(1, viewport.height - 96);
    const scale = Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height, 1);
    return {
      width: Math.max(1, Math.floor(dimensions.width * scale)),
      height: Math.max(1, Math.floor(dimensions.height * scale)),
      scale,
    };
  }, [dimensions, viewport]);

  const activeZoom = fitMode && fitted ? fitted.scale : zoom;
  const imageStyle = dimensions
    ? { width: `${Math.max(1, Math.round(dimensions.width * activeZoom))}px`, height: `${Math.max(1, Math.round(dimensions.height * activeZoom))}px` }
    : undefined;
  const canvasStyle = dimensions && fitted
    ? {
        width: `${Math.max(fitted.width, Math.round(dimensions.width * activeZoom))}px`,
        height: `${Math.max(fitted.height, Math.round(dimensions.height * activeZoom))}px`,
      }
    : undefined;

  useEffect(() => {
    const onResize = () => setViewport(getViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
        : currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      event.preventDefault();
      focusable[nextIndex].focus();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      triggerRef.current?.focus();
    };
  }, [onClose]);

  const setFit = () => {
    if (!fitted) return;
    setFitMode(true);
    setZoom(fitted.scale);
  };
  const setManualZoom = (nextZoom: number) => {
    setFitMode(false);
    setZoom(clampZoom(nextZoom));
  };

  const lightbox = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px] sm:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={alt || '图片预览'} className="contents">
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-6 sm:top-6">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/85 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
            aria-label="关闭图片预览"
            title="关闭（Esc）"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex h-full w-full items-center justify-center overflow-auto">
          {loading && !failed && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-white/75">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在加载图片…
            </div>
          )}
          {failed ? (
            <div className="rounded-xl bg-white/10 px-5 py-4 text-sm text-white/80 ring-1 ring-white/15">图片加载失败</div>
          ) : (
            <div className="grid min-h-full min-w-full place-items-center" style={canvasStyle}>
              <img
                src={src}
                alt={alt}
                onLoad={(event) => {
                  setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                  setLoading(false);
                }}
                onError={() => {
                  setFailed(true);
                  setLoading(false);
                }}
                onDoubleClick={() => {
                  if (!fitted) return;
                  if (Math.abs(activeZoom - 1) < 0.01) setFit();
                  else setManualZoom(1);
                }}
                className={`block max-w-none select-none object-contain shadow-2xl transition-opacity duration-150 ${loading ? 'opacity-0' : 'opacity-100'}`}
                style={imageStyle}
              />
            </div>
          )}
        </div>

        {!failed && !loading && fitted && (
          <div className="absolute bottom-4 left-1/2 z-20 flex h-10 -translate-x-1/2 items-center rounded-lg bg-black/55 p-1 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-sm sm:bottom-6">
            <button type="button" onClick={() => setManualZoom(activeZoom - 0.25)} disabled={activeZoom <= 0.25} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" aria-label="缩小图片"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={() => setManualZoom(1)} className="h-8 min-w-14 rounded-md px-2 text-xs font-medium tabular-nums transition hover:bg-white/15" title="按原始大小显示">{Math.round(activeZoom * 100)}%</button>
            <button type="button" onClick={() => setManualZoom(activeZoom + 0.25)} disabled={activeZoom >= 4} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" aria-label="放大图片"><Plus className="h-4 w-4" /></button>
            <span className="mx-1 h-4 w-px bg-white/20" />
            <button type="button" onClick={setFit} className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition ${fitMode ? 'bg-white/15' : 'hover:bg-white/15'}`} title="适应屏幕"><Maximize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">适应</span></button>
          </div>
        )}
      </section>
    </div>
  );

  // 预览挂到 body，避免后台布局的 sticky/overflow 容器截断全屏遮罩。
  return typeof document === 'undefined' ? lightbox : createPortal(lightbox, document.body);
};

interface VideoLightboxProps {
  src: string;
  title: string;
  mimeType?: string;
  onClose: () => void;
}

export const VideoLightbox: React.FC<VideoLightboxProps> = ({ src, title, mimeType, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      videoRef.current?.pause();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      triggerRef.current?.focus();
    };
  }, [onClose]);

  const lightbox = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px] sm:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/85 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
          aria-label="关闭视频预览"
          title="关闭（Esc）"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {loading && !failed && (
        <div className="absolute z-10 flex items-center gap-2 text-sm text-white/75">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          正在加载视频…
        </div>
      )}
      {failed ? (
        <div className="rounded-xl bg-white/10 px-5 py-4 text-sm text-white/80 ring-1 ring-white/15">视频加载失败</div>
      ) : (
        <video
          ref={videoRef}
          controls
          preload="metadata"
          aria-label={title}
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          className={`max-h-[calc(100dvh-2rem)] max-w-full bg-black shadow-2xl transition-opacity duration-150 sm:max-h-[calc(100dvh-4rem)] ${loading ? 'opacity-0' : 'opacity-100'}`}
        >
          <source src={src} type={mimeType} />
          当前浏览器不支持该视频格式。
        </video>
      )}
    </div>
  );

  return typeof document === 'undefined' ? lightbox : createPortal(lightbox, document.body);
};
