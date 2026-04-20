"use client";

import { useState, type ReactNode } from "react";

export type TabDef = {
  value: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabDef[];
  defaultValue?: string;
};

/**
 * Lightweight accessible tab shell. Roles + aria-selected for screen
 * readers, hidden attribute toggles panel visibility (so all panels mount
 * on the client and keep their per-section dirty state across switches).
 */
export function Tabs({ tabs, defaultValue }: TabsProps) {
  const [active, setActive] = useState<string>(
    defaultValue ?? tabs[0]?.value ?? ""
  );

  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.value}`}
              id={`tab-${tab.value}`}
              onClick={() => setActive(tab.value)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-white text-zinc-950"
                  : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={`tabpanel-${tab.value}`}
          aria-labelledby={`tab-${tab.value}`}
          hidden={active !== tab.value}
          className="mt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
