import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function SearchBar({ onSearch, isLoading = false, value, onChange, onClear }) {
  const [hint, setHint] = useState('');
  const input = useRef(null);
  function handleSubmit(event) {
    event.preventDefault();
    const query = value.trim();
    if (query.length < 2) { setHint('Enter at least 2 characters to search.'); return; }
    setHint('');
    onSearch(query);
  }
  return <form className="search-bar" onSubmit={handleSubmit} role="search">
    <div className="search-bar__row">
      <Icon name="search" size={23} />
      <input ref={input} type="search" name="query" value={value} onChange={(event) => { onChange(event.target.value); setHint(''); }} placeholder="A better water bottle? Start here…" aria-label="Search EcoSearch" aria-describedby={hint ? 'search-hint' : undefined} aria-invalid={Boolean(hint)} maxLength={100} autoComplete="off" />
      {value && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => { setHint(''); onClear(); input.current?.focus(); }}><Icon name="close" size={18} /></button>}
      <button className="search-submit" type="submit" disabled={isLoading}>{isLoading ? 'Searching…' : 'Search'}<Icon name="arrow" size={17} /></button>
    </div>
    {hint && <p className="search-bar__hint" id="search-hint" role="alert">{hint}</p>}
  </form>;
}
