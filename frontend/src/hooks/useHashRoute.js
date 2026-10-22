import { useEffect, useState } from 'react';

function currentPath() {
  const hash = globalThis.location?.hash || '#/';
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  return withoutHash || '/';
}

/** Tiny dependency-free hash router: '#/login', '#/dashboard', ... */
export function useHashRoute() {
  const [route, setRoute] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setRoute(currentPath());
    globalThis.addEventListener?.('hashchange', onChange);
    return () => globalThis.removeEventListener?.('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path) {
  if (globalThis.location) globalThis.location.hash = `#${path}`;
}

export function parseRoute(route) {
  const [pathname = '/', search = ''] = route.split('?');
  const params = new URLSearchParams(search);
  return { pathname: pathname || '/', params };
}
