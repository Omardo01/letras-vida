import clsx from "clsx";
import { DEFAULT_DESIGN, FONTS, PRESETS, REF_H, type Design } from "../lib/design";
import { BOX_PAD, BOX_TOP } from "../lib/render";

interface Props {
  design: Design;
  onChange: (d: Design) => void;
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-panel p-0.5" />
        <code className="text-xs text-muted">{value}</code>
      </span>
    </label>
  );
}

function Range({ label, value, min, max, step = 1, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-accent" />
    </label>
  );
}

export function DesignPanel({ design, onChange }: Props) {
  const set = (patch: Partial<Design>) => onChange({ ...design, ...patch });

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set({ logo: reader.result as string, showLogo: true });
    reader.readAsDataURL(file);
  };

  const activePreset = PRESETS.find((p) => Object.entries(p.values).every(([k, v]) => design[k as keyof Design] === v))?.name;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs text-muted">Diseños predeterminados</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => set(p.values)}
              className={clsx(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                activePreset === p.name ? "border-accent bg-blue-50/60" : "border-line hover:border-accent/50",
              )}
            >
              <span
                className="flex h-9 w-full items-center justify-center gap-1 rounded"
                style={{ background: p.values.background === "transparent" ? "repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 0 0 / 10px 10px" : p.values.background }}
              >
                <span className="h-2.5 w-7 rounded-full" style={{ background: p.values.pillColor }} />
                <span className="h-4 w-9 rounded-sm" style={{ background: p.values.boxColor }} />
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Color label="Píldora" value={design.pillColor} onChange={(v) => set({ pillColor: v })} />
        <Color label="Texto de la píldora" value={design.pillTextColor} onChange={(v) => set({ pillTextColor: v })} />
        <Color label="Caja" value={design.boxColor} onChange={(v) => set({ boxColor: v })} />
        <Color label="Texto" value={design.textColor} onChange={(v) => set({ textColor: v })} />
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>Fondo</span>
          <span className="flex items-center gap-2">
            <select
              value={design.background === "transparent" ? "transparent" : "color"}
              onChange={(e) => set({ background: e.target.value === "transparent" ? "transparent" : "#ffffff" })}
              className="rounded border border-line bg-panel px-2 py-1 text-sm"
            >
              <option value="color">Color</option>
              <option value="transparent">Transparente (PNG)</option>
            </select>
            {design.background !== "transparent" && (
              <input type="color" value={design.background} onChange={(e) => set({ background: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-line bg-panel p-0.5" />
            )}
          </span>
        </label>
      </div>

      <label className="block text-sm">
        <span>Fuente</span>
        <select value={design.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-sm">
          {FONTS.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
      </label>

      <Range label="Tamaño máximo del texto" value={design.maxFontSize} min={24} max={72} onChange={(v) => set({ maxFontSize: v, minFontSize: Math.min(design.minFontSize, v) })} />
      <Range label="Tamaño mínimo (pasajes largos)" value={design.minFontSize} min={14} max={design.maxFontSize} onChange={(v) => set({ minFontSize: v })} />
      <Range label="Tamaño de los títulos" value={design.titleFontSize} min={30} max={130} onChange={(v) => set({ titleFontSize: v })} />
      <Range label="Tamaño de la cita" value={design.pillFontSize} min={20} max={48} onChange={(v) => set({ pillFontSize: v })} />
      <Range label="Ancho de la caja" value={design.boxWidth} min={1200} max={1960} step={10} onChange={(v) => set({ boxWidth: v })} />
      <Range label="Ancho del bloque de texto" value={design.textMaxWidth} min={700} max={design.boxWidth - 2 * BOX_PAD} step={10} onChange={(v) => set({ textMaxWidth: v })} />
      <Range label="Alto de la caja" value={design.boxHeight} min={200} max={REF_H - BOX_TOP - 12} step={2} onChange={(v) => set({ boxHeight: v })} />
      <Range label="Redondeo de la caja" value={design.boxRadius} min={0} max={80} onChange={(v) => set({ boxRadius: v })} />

      <div className="space-y-2 rounded-lg border border-line p-3">
        <label className="flex items-center justify-between text-sm">
          <span>Mostrar logo</span>
          <input type="checkbox" checked={design.showLogo} onChange={(e) => set({ showLogo: e.target.checked })} className="accent-accent" />
        </label>
        <Range label="Tamaño del logo" value={design.logoScale} min={0.5} max={1.8} step={0.05} onChange={(v) => set({ logoScale: v })} unit="×" />
        <label className="block text-sm">
          <span className="text-muted">Cambiar logo (PNG con transparencia)</span>
          <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={(e) => onLogoFile(e.target.files?.[0])} className="mt-1 block w-full text-xs" />
        </label>
      </div>

      <button onClick={() => onChange(DEFAULT_DESIGN)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
        Restablecer diseño original
      </button>
    </div>
  );
}
