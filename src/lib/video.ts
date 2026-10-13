import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Design } from "./design";
import { drawSlide, IN_SECONDS, OUT_SECONDS } from "./render";
import type { Slide } from "./slides";

export type VideoMode = "in-hold" | "in-hold-out";

export interface VideoOptions {
  width: number;
  height: number;
  fps: number;
  mode: VideoMode;
  /** Segundos con el versículo completo en pantalla. */
  hold: number;
}

export const videoSupported = () => typeof window !== "undefined" && "VideoEncoder" in window;

/** Elige el perfil H.264 más alto que el navegador acepte para ese tamaño. */
async function pickConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig> {
  const bitrate = Math.round(width * height * fps * 0.07); // ~17 Mbps para 3840×1080@60
  for (const codec of ["avc1.64003E", "avc1.640034", "avc1.640033", "avc1.4D0033", "avc1.42E033"]) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return config;
    } catch {
      /* siguiente */
    }
  }
  throw new Error(`Este navegador no puede codificar H.264 a ${width}×${height}@${fps}. Prueba una resolución menor o Chrome.`);
}

export async function renderVideo(
  slide: Slide,
  design: Design,
  logo: HTMLImageElement | null,
  opts: VideoOptions,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  if (!videoSupported()) throw new Error("Tu navegador no soporta WebCodecs (usa Chrome o Edge).");
  const { width, height, fps } = opts;
  const total = IN_SECONDS + opts.hold + (opts.mode === "in-hold-out" ? OUT_SECONDS : 0);
  const frames = Math.round(total * fps);
  const outStart = opts.mode === "in-hold-out" ? IN_SECONDS + opts.hold : Infinity;

  const config = await pickConfig(width, height, fps);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure(config);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const frameUs = Math.round(1_000_000 / fps);

  for (let i = 0; i < frames; i++) {
    if (failure) throw failure;
    drawSlide(ctx, width, height, design, slide, logo, { t: i / fps, outStart });
    const frame = new VideoFrame(canvas, { timestamp: i * frameUs, duration: frameUs });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    // Deja respirar al codificador y a la UI.
    if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    onProgress?.((i + 1) / frames);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
