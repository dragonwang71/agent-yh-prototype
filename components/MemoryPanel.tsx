"use client";

import { useEffect, useState } from "react";

type MemoryPanelText = {
  edit: string;
  preview: string;
  update: string;
  updateFailed: string;
  updating: string;
};

type MemoryPanelProps = {
  memory: string;
  onRefresh: (memory: string) => Promise<void>;
  onSave: (memory: string) => void;
  text: MemoryPanelText;
};

export function MemoryPanel({ memory, onRefresh, onSave, text }: MemoryPanelProps) {
  const [draft, setDraft] = useState(memory);
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    setDraft(memory);
  }, [memory]);

  function updateMemory(nextMemory: string) {
    setDraft(nextMemory);
    onSave(nextMemory);
    setRefreshFailed(false);
  }

  async function refreshMemory() {
    setIsRefreshing(true);
    setRefreshFailed(false);

    try {
      await onRefresh(draft);
    } catch {
      setRefreshFailed(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f4ee] px-5 py-6">
      <div className="mx-auto flex w-full max-w-[780px] shrink-0 justify-end gap-2">
        <button
          className="rounded-full bg-[#ebe7df] px-4 py-2 text-base font-medium text-[#24211c] outline-none transition hover:bg-[#e2ddd4] disabled:text-[#9a9183] focus-visible:bg-[#e2ddd4]"
          disabled={isRefreshing}
          onClick={refreshMemory}
          type="button"
        >
          {isRefreshing ? text.updating : refreshFailed ? text.updateFailed : text.update}
        </button>
        <button
          className="rounded-full bg-[#ebe7df] px-4 py-2 text-base font-medium text-[#24211c] outline-none transition hover:bg-[#e2ddd4] focus-visible:bg-[#e2ddd4]"
          onClick={() => setIsEditing((current) => !current)}
          type="button"
        >
          {isEditing ? text.preview : text.edit}
        </button>
      </div>

      <div className="mx-auto mt-5 min-h-0 w-full max-w-[780px] flex-1 overflow-y-auto">
        {isEditing ? (
          <textarea
            className="min-h-full w-full rounded-2xl border border-[#ded8cf] bg-[#fbfaf7] p-5 font-mono text-base leading-8 text-[#24211c] outline-none focus:border-[#c9bda9]"
            onChange={(event) => updateMemory(event.target.value)}
            value={draft}
          />
        ) : (
          <div className="min-h-full rounded-2xl bg-[#fbfaf7] p-6">
            <MarkdownPreview markdown={draft} />
          </div>
        )}
      </div>
    </section>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-base leading-8 text-[#24211c]">
      {markdown.split("\n").map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div className="h-2" key={`${index}-blank`} />;
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h1 className="pt-1 text-2xl font-semibold" key={`${index}-${trimmed}`}>
              {trimmed.slice(2)}
            </h1>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 className="pt-4 text-lg font-semibold" key={`${index}-${trimmed}`}>
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div className="grid grid-cols-[18px_1fr] gap-2" key={`${index}-${trimmed}`}>
              <span className="text-[#7c7466]">-</span>
              <p>{trimmed.slice(2)}</p>
            </div>
          );
        }

        return <p key={`${index}-${trimmed}`}>{trimmed}</p>;
      })}
    </div>
  );
}
