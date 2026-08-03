"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EmbedColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onPreviewChange?: (color: string | null) => void;
  className?: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

const DEFAULT_COLOR = "#3b82f6";
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const PRESET_COLORS = [
  "#ffffff",
  "#95a5a6",
  "#e67e22",
  "#e91e63",
  "#f1c40f",
  "#57f287",
  "#1abc9c",
  "#3498db",
  "#5865f2",
  "#9b59b6",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(value: string): string | null {
  const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return HEX_REGEX.test(normalized) ? normalized.toUpperCase() : null;
}

function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex) ?? DEFAULT_COLOR;
  const value = normalized.slice(1);

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) {
    red = chroma;
    green = x;
  } else if (h < 120) {
    red = x;
    green = chroma;
  } else if (h < 180) {
    green = chroma;
    blue = x;
  } else if (h < 240) {
    green = x;
    blue = chroma;
  } else if (h < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
}

export default function EmbedColorPicker({ value, onChange, onPreviewChange, className }: EmbedColorPickerProps) {
  const normalizedValue = normalizeHex(value) ?? DEFAULT_COLOR;
  const [open, setOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(normalizedValue);
  const [hexInput, setHexInput] = useState(normalizedValue.slice(1));
  const [history, setHistory] = useState<string[]>([]);
  const previewFrameRef = useRef<number | null>(null);
  const pendingPreviewColorRef = useRef<string | null>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const rgb = useMemo(() => hexToRgb(draftColor), [draftColor]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);

  useEffect(() => {
    if (!open) {
      setDraftColor(normalizedValue);
      setHexInput(normalizedValue.slice(1));
    }
  }, [normalizedValue, open]);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) {
      cancelAnimationFrame(previewFrameRef.current);
    }
  }, []);

  const previewColor = (nextColor: string) => {
    pendingPreviewColorRef.current = nextColor;
    if (previewFrameRef.current !== null) {
      return;
    }

    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      if (pendingPreviewColorRef.current) {
        onPreviewChange?.(pendingPreviewColorRef.current);
      }
    });
  };

  const updateDraftColor = (nextColor: string) => {
    const normalized = normalizeHex(nextColor);
    if (!normalized) {
      return;
    }

    setDraftColor(normalized);
    setHexInput(normalized.slice(1));
    previewColor(normalized);
  };

  const commitColor = (nextColor = draftColor) => {
    const normalized = normalizeHex(nextColor);
    if (!normalized) {
      return;
    }

    setDraftColor(normalized);
    setHexInput(normalized.slice(1));
    setHistory((currentHistory) => [normalized, ...currentHistory.filter((color) => color !== normalized)].slice(0, 5));
    onChange(normalized);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      commitColor(draftColor);
      onPreviewChange?.(null);
    }
  };

  const updateFromSaturationPointer = (event: React.PointerEvent<HTMLDivElement>, shouldCommit = false) => {
    const rect = saturationRef.current?.getBoundingClientRect();
    if (!rect) return;

    const saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const valueChannel = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    const nextColor = rgbToHex(hsvToRgb({ h: hsv.h, s: saturation, v: valueChannel }));

    updateDraftColor(nextColor);
    if (shouldCommit) {
      commitColor(nextColor);
    }
  };

  const updateFromHuePointer = (event: React.PointerEvent<HTMLDivElement>, shouldCommit = false) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;

    const hue = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
    const nextColor = rgbToHex(hsvToRgb({ h: hue, s: hsv.s, v: hsv.v }));

    updateDraftColor(nextColor);
    if (shouldCommit) {
      commitColor(nextColor);
    }
  };

  const handleHexChange = (rawValue: string) => {
    const nextValue = rawValue.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
    setHexInput(nextValue);

    if (nextValue.length === 6) {
      updateDraftColor(`#${nextValue}`);
    }
  };

  const handleHexCommit = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      commitColor(normalized);
      return;
    }

    setHexInput(draftColor.slice(1));
  };

  const handleRgbChange = (channel: keyof RgbColor, rawValue: string) => {
    const numericValue = clamp(Number(rawValue || 0), 0, 255);
    const nextColor = rgbToHex({ ...rgb, [channel]: numericValue });
    updateDraftColor(nextColor);
    commitColor(nextColor);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-md bg-dark-900 text-[#94a0b8] transition-colors hover:text-white",
            className
          )}
          aria-label="Kolor embeda"
          title="Kolor embeda"
        >
          <Palette className="h-4 w-4" />
          <span
            className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-white/50"
            style={{ backgroundColor: draftColor }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[268px] border-[#2f3341] bg-dark-800 p-4 text-[#d8dbe6] shadow-xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#c4cad8]">Discord colors</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => commitColor(color)}
                  className="relative h-4 w-4 rounded-full border border-white/10 ring-offset-2 ring-offset-dark-800 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bot-primary"
                  style={{ backgroundColor: color }}
                  aria-label={`Ustaw kolor ${color}`}
                >
                  {draftColor === color ? <Check className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-black mix-blend-difference" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[#c4cad8]">History</div>
            <div className="flex min-h-4 gap-2">
              {(history.length > 0 ? history : [draftColor]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => commitColor(color)}
                  className="h-4 w-4 rounded-full border border-white/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bot-primary"
                  style={{ backgroundColor: color }}
                  aria-label={`Ustaw kolor ${color}`}
                />
              ))}
            </div>
          </div>

          <div
            ref={saturationRef}
            className="relative h-44 cursor-crosshair overflow-hidden rounded-md border border-[#2f3341]"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateFromSaturationPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) updateFromSaturationPointer(event);
            }}
            onPointerUp={(event) => updateFromSaturationPointer(event, true)}
          >
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>

          <div
            ref={hueRef}
            className="relative h-2 cursor-pointer rounded-full"
            style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateFromHuePointer(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) updateFromHuePointer(event);
            }}
            onPointerUp={(event) => updateFromHuePointer(event, true)}
          >
            <span
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-2">
            <label className="space-y-1">
              <input
                value={hexInput}
                onChange={(event) => handleHexChange(event.target.value)}
                onBlur={handleHexCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleHexCommit();
                }}
                className="h-9 w-full rounded-md border border-[#2f3341] bg-dark-900 px-2 text-xs text-white outline-none transition-colors focus:border-bot-primary"
                aria-label="Hex"
              />
              <span className="block text-[11px] text-[#8d94a8]">Hex</span>
            </label>
            {(["r", "g", "b"] as const).map((channel) => (
              <label key={channel} className="space-y-1">
                <input
                  value={rgb[channel]}
                  onChange={(event) => handleRgbChange(channel, event.target.value)}
                  className="h-9 w-full rounded-md border border-[#2f3341] bg-dark-900 px-2 text-xs text-white outline-none transition-colors focus:border-bot-primary"
                  inputMode="numeric"
                  aria-label={channel.toUpperCase()}
                />
                <span className="block text-[11px] uppercase text-[#8d94a8]">{channel}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
