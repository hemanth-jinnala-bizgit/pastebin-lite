"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconX } from "./icons";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const node = (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast">
          <span className="toast-icon"><IconCheck width={14} height={14} /></span>
          {message}
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setMessage(null)}>
            <IconX width={14} height={14} />
          </button>
        </div>
      )}
    </div>
  );
  return { show, node };
}
