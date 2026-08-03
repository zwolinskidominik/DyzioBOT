"use client";

interface CustomSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  /** Wartości, dla których pod suwakiem pojawi się etykieta (np. [0, 10, 20, 30, 40, 50]). */
  ticks?: number[];
  /** Formatowanie etykiety dla danej wartości ticka (domyślnie "OFF" dla 0, inaczej "{v} XP"). */
  formatTick?: (tickValue: number) => string;
}

const FILL_COLOR = "#3b82f6"; // spójne z DeezySwitch/focus-ring reszty modułów
const TRACK_COLOR = "#17181E"; // dark.900

/**
 * Lekki, natywny <input type="range"> ostylowany na ciemny track +
 * niebieskie wypełnienie + białe kółko-thumb (zamiast domyślnego
 * natywnego wyglądu przeglądarki). Kolor wypełnienia liczony jest
 * przez linear-gradient na podstawie aktualnej wartości, więc śledzi
 * przeciąganie bez dodatkowego JS-owego przerysowywania.
 */
const defaultFormatTick = (tickValue: number) => (tickValue === 0 ? "OFF" : `${tickValue} XP`);

export function CustomSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  ariaLabel,
  ticks,
  formatTick = defaultFormatTick,
}: CustomSliderProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const clamped = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="w-full">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="custom-slider-input"
        style={{
          background: `linear-gradient(to right, ${FILL_COLOR} 0%, ${FILL_COLOR} ${clamped}%, ${TRACK_COLOR} ${clamped}%, ${TRACK_COLOR} 100%)`,
        }}
      />
      {ticks && ticks.length > 0 ? (
        <div className="mt-2 flex items-center justify-between">
          {ticks.map((tick) => (
            <span key={tick} className="text-xs font-medium text-[#c4cad8]">
              {formatTick(tick)}
            </span>
          ))}
        </div>
      ) : null}
      <style jsx>{`
        .custom-slider-input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          opacity: ${disabled ? 0.5 : 1};
        }
        .custom-slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid ${FILL_COLOR};
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
        }
        .custom-slider-input::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid ${FILL_COLOR};
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
        }
        .custom-slider-input::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(to right, ${FILL_COLOR} 0%, ${FILL_COLOR} ${clamped}%, ${TRACK_COLOR} ${clamped}%, ${TRACK_COLOR} 100%);
        }
      `}</style>
    </div>
  );
}

export default CustomSlider;
