import { useEffect, useState } from 'react';

// Client-side debounce so typeahead (37.5) fires on a settled value, not every
// keystroke.
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
