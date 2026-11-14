/** Accessible tabs (tablist / tab / tabpanel), arrow keys move between tabs. */
import { useRef, type ReactNode } from "react";

export interface TabDef { id: string; label: string }

interface Props { tabs: TabDef[]; active: string; onChange: (id: string) => void; idPrefix: string; children?: ReactNode }

export function Tabs({ tabs, active, onChange, idPrefix, children }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + tabs.length) % tabs.length;
    onChange(tabs[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`${idPrefix}-tab-${t.id}`}
            aria-selected={t.id === active} aria-controls={`${idPrefix}-panel-${t.id}`} tabIndex={t.id === active ? 0 : -1}
            onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${idPrefix}-panel-${active}`} aria-labelledby={`${idPrefix}-tab-${active}`}>
        {children}
      </div>
    </div>
  );
}
