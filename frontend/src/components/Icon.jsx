const paths = {
  leaf: <><path d="M20 4c-9-2-16 1-16 8a7 7 0 0 0 12 5c4-4 4-9 4-13Z" /><path d="M4 21c1-6 5-10 11-13" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  sparkles: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.01" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9 9-4M12 12 3 8m9 4v10M8 5l9 5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.2 6A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.8 6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  heart: <path d="M19.5 12.6 12 20l-7.5-7.4a4.5 4.5 0 1 1 7.5-5.2 4.5 4.5 0 1 1 7.5 5.2Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export default function Icon({ name = 'leaf', size = 20, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.leaf}</svg>;
}
