import { useEffect, useRef, useState } from 'react';

export function useCopy(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = (text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), ms);
      })
      .catch(() => {});
  };

  return { copied, copy };
}
