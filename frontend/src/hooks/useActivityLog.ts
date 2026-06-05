import { useState } from "react";
import type { ActivityEntry } from "../types";

export function useActivityLog() {
  const [activity, setActivity] = useState<ActivityEntry[]>([
    { id: 1, text: "local fallback mode active", ts: Date.now() },
  ]);

  function addActivity(text: string) {
    setActivity((items) => [{ id: Date.now() + Math.random(), text, ts: Date.now() }, ...items].slice(0, 10));
  }

  return { activity, addActivity };
}

