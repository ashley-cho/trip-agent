"use client";

import { useEffect, useState } from "react";
import { modelState, onModel, type ModelState } from "@/lib/model-state";
import { limitState, onLimit } from "@/lib/byok";

/**
 * "Model: on" or "Model: off", top right.
 *
 * Replaces a pill reading "Auto" that cycled the colour theme and told the
 * person nothing about the one thing that changes what they are judging:
 * whether a model is answering or the rules floor is. The theme control
 * moved to the notes at the bottom, with a label that says what it is.
 */
export function ModelBadge() {
  const [model, setModel] = useState<ModelState>("unknown");
  const [account, setAccount] = useState(false);

  useEffect(() => {
    setModel(modelState());
    setAccount(limitState().reason === "account");
    const a = onModel(setModel);
    const b = onLimit((s) => setAccount(s.reason === "account"));
    return () => { a(); b(); };
  }, []);

  const off = account || model === "off";
  const label = off ? "Model: off" : model === "on" ? "Model: on" : "Model";
  const title = off
    ? "No model is answering right now. Planning comes from the catalogue; language understanding is rules."
    : model === "on" ? "A model answered the last call." : "Not known yet: nothing has needed a model.";
  return (
    <span
      title={title}
      className={`rounded-none border border-paper-edge px-2.5 py-0.5 text-[13px] tracking-wide ${off ? "text-ink-faint" : "text-ink-soft"}`}
    >
      {label}
    </span>
  );
}
