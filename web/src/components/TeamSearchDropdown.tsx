'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export interface Team {
  _id: string;
  name: string;
  monicker?: string | null;
  logo?: string | null;
}

interface Props {
  label: string;
  teams: Team[];
  value: string | null;        // selected team _id
  onChange: (id: string) => void;
  excludeId?: string | null;   // prevent selecting the same team twice
  error?: string;
}

export default function TeamSearchDropdown({ label, teams, value, onChange, excludeId, error }: Props) {
  const [query, setQuery]     = useState('');
  const [open, setOpen]       = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  const selected = teams.find((t) => t._id === value) ?? null;

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filtered = teams.filter((t) => {
    if (t._id === excludeId) return false;
    const q = query.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.monicker ?? '').toLowerCase().includes(q)
    );
  });

  function handleSelect(team: Team) {
    onChange(team._id);
    setOpen(false);
    setQuery('');
  }

  function handleClear() {
    onChange('');
    setQuery('');
    setOpen(true);
  }

  const borderClass = error
    ? 'border-danger focus-within:ring-2 focus-within:ring-danger/20'
    : open
    ? 'border-primary/50 ring-2 ring-primary/20'
    : 'border-black/12 hover:border-black/20';

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-xs font-semibold text-offblack/70 uppercase tracking-wide">
        {label} <span className="text-danger">*</span>
      </label>

      {/* Trigger */}
      <div
        className={`relative w-full rounded-lg border bg-offwhite/50 transition-all cursor-pointer ${borderClass}`}
        onClick={() => { if (!open) { setOpen(true); } }}
      >
        {selected && !open ? (
          /* Selected state */
          <div className="flex items-center gap-2.5 px-3 py-2 pr-8">
            {selected.logo ? (
              <Image
                src={selected.logo}
                alt={selected.name}
                width={24}
                height={24}
                className="rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-primary">
                  {selected.name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-offblack truncate">{selected.name}</p>
              {selected.monicker && (
                <p className="text-xs text-offblack/40 truncate">{selected.monicker}</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-offblack/30 hover:text-offblack/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          /* Search input */
          <div className="flex items-center gap-2 px-3 py-2">
            <svg className="w-4 h-4 text-offblack/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              autoFocus={open}
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              className="flex-1 bg-transparent text-sm text-offblack placeholder:text-offblack/25 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="relative z-20">
          <div className="absolute top-0 left-0 right-0 bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-offblack/40 text-center">
                {query ? `No teams matching "${query}"` : 'No teams available.'}
              </p>
            ) : (
              filtered.map((team) => (
                <button
                  key={team._id}
                  type="button"
                  onClick={() => handleSelect(team)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-offwhite transition-colors text-left"
                >
                  {team.logo ? (
                    <Image
                      src={team.logo}
                      alt={team.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-primary">{team.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-offblack">{team.name}</p>
                    {team.monicker && (
                      <p className="text-xs text-offblack/40">{team.monicker}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-danger font-medium">{error}</p>}
    </div>
  );
}
