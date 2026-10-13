import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import type { Design } from "../lib/design";
import { drawSlide, IN_SECONDS, OUT_SECONDS } from "../lib/render";
import type { Slide } from "../lib/slides";

export interface SlideCanvasHandle {
  play: (hold: number, withOut: boolean) => void;
}

interface Props {
  slide: Slide;
  design: Design;
  logo: HTMLImageElement | null;
  /** Ancho de dibujo interno; la altura sale del aspecto elegido. */
  width: number;
  aspect: number; // W/H
  className?: string;
  fontsReady: boolean;
}

/** Vista previa de un slide con el MISMO dibujado que el PNG y el video. */
export const SlideCanvas = forwardRef<SlideCanvasHandle, Props>(function SlideCanvas(
  { slide, design, logo, width, aspect, className, fontsReady },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const height = Math.round(width / aspect);

  const drawStatic = () => {
    const c = canvasRef.current;
    if (!c) return;
    drawSlide(c.getContext("2d")!, c.width, c.height, design, slide, logo);
  };

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    drawStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.label, slide.text, slide.error, design, logo, width, height, fontsReady]);

  useImperativeHandle(ref, () => ({
    play: (hold, withOut) => {
      const c = canvasRef.current;
      if (!c) return;
      if (raf.current) cancelAnimationFrame(raf.current);
      const ctx = c.getContext("2d")!;
      const start = performance.now();
      const outStart = withOut ? IN_SECONDS + hold : Infinity;
      const total = IN_SECONDS + hold + (withOut ? OUT_SECONDS : 0);
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        drawSlide(ctx, c.width, c.height, design, slide, logo, { t, outStart });
        if (t < total + 0.2) raf.current = requestAnimationFrame(tick);
        else {
          raf.current = null;
          drawStatic();
        }
      };
      raf.current = requestAnimationFrame(tick);
    },
  }));

  return <canvas ref={canvasRef} width={width} height={height} className={className} style={{ aspectRatio: `${aspect}` }} />;
});
