"use client";

import { Download, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UiCopy } from "@/lib/i18n";
import type { MemoryItem } from "@/lib/types";

type MemoryPanelProps = {
  memory: MemoryItem[];
  onChange: (memory: MemoryItem[]) => void;
  text: UiCopy;
};

export function MemoryPanel({ memory, onChange, text }: MemoryPanelProps) {
  const [editingId, setEditingId] = useState("");
  const approved = memory.filter((item) => item.status === "approved");
  const grouped = useMemo(
    () =>
      approved.reduce<Partial<Record<MemoryItem["namespace"], MemoryItem[]>>>(
        (groups, item) => {
          groups[item.namespace] = [...(groups[item.namespace] ?? []), item];
          return groups;
        },
        {}
      ),
    [approved]
  );

  function remove(id: string) {
    onChange(memory.filter((item) => item.id !== id));
    setEditingId("");
  }

  function update(id: string, value: string) {
    const updatedAt = new Date().toISOString();
    onChange(
      memory.map((item) =>
        item.id === id
          ? {
              ...item,
              value: coerceEditedValue(value, item.value),
              updatedAt
            }
          : item
      )
    );
  }

  function exportMemory() {
    const blob = new Blob([JSON.stringify(approved, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "agent-yh-memory.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-7 sm:px-8">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#111827]">{text.memory}</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#6b7280]">{text.memoryIntro}</p>
            <p className="mt-1 text-xs text-[#9ca3af]">{text.memoryLocalOnly}</p>
          </div>

          {approved.length ? (
            <div className="flex items-center gap-1">
              <button
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#4b5563] transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                onClick={exportMemory}
                type="button"
              >
                <Download aria-hidden="true" size={15} />
                {text.exportMemory}
              </button>
              <button
                className="min-h-9 rounded-lg px-3 text-sm font-medium text-[#b42318] transition hover:bg-[#fff0f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                onClick={() => onChange([])}
                type="button"
              >
                {text.clearMemory}
              </button>
            </div>
          ) : null}
        </div>

        {approved.length ? (
          <div className="mt-9 space-y-8">
            {(Object.entries(grouped) as Array<[MemoryItem["namespace"], MemoryItem[]]>).map(
              ([namespace, items]) => (
                <section key={namespace}>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
                    {text.memoryNamespaces[namespace]}
                  </h2>
                  <div className="mt-2 overflow-hidden rounded-2xl bg-[#f7f7f8]">
                    {items.map((item, index) => {
                      const isEditing = editingId === item.id;

                      return (
                        <div
                          className={`px-4 py-4 sm:px-5 ${
                            index ? "border-t border-white" : ""
                          }`}
                          key={item.id}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#374151]">
                                {formatKey(item.key)}
                              </p>
                              {isEditing ? (
                                <input
                                  aria-label={`${text.edit}: ${item.key}`}
                                  autoFocus
                                  className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm text-[#111827] outline-none ring-1 ring-[#d1d5db] focus:ring-2 focus:ring-[#ff99ad]"
                                  defaultValue={formatValue(item.value)}
                                  onBlur={(event) => {
                                    update(item.id, event.currentTarget.value);
                                    setEditingId("");
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      setEditingId("");
                                    }
                                  }}
                                />
                              ) : (
                                <p className="mt-1 break-words text-base leading-6 text-[#111827]">
                                  {formatValue(item.value)}
                                </p>
                              )}
                              <p className="mt-2 text-xs text-[#9ca3af]">
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                aria-label={`${text.edit}: ${item.key}`}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-white hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                                onClick={() => setEditingId(item.id)}
                                type="button"
                              >
                                <Pencil aria-hidden="true" size={15} />
                              </button>
                              <button
                                aria-label={`${text.deleteMemory}: ${item.key}`}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9ca3af] transition hover:bg-[#fff0f3] hover:text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff99ad]"
                                onClick={() => remove(item.id)}
                                type="button"
                              >
                                <Trash2 aria-hidden="true" size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )
            )}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-base text-[#6b7280]">{text.memoryEmpty}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatKey(key: string) {
  return key.replaceAll("_", " ");
}

function formatValue(value: MemoryItem["value"]) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function coerceEditedValue(value: string, previous: MemoryItem["value"]): MemoryItem["value"] {
  if (Array.isArray(previous)) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof previous === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : previous;
  }

  if (typeof previous === "boolean") {
    return value.trim().toLowerCase() === "true";
  }

  return value.trim();
}
