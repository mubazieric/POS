export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#F26A1B" />
      <path d="M148 140h216a20 20 0 0 1 20 20v222l-32-20-32 20-32-20-32 20-32-20-32 20-32-20-32 20V160a20 20 0 0 1 20-20z" fill="#fff" />
      <rect x="182" y="196" width="148" height="20" rx="10" fill="#F26A1B" />
      <rect x="182" y="242" width="104" height="20" rx="10" fill="#FDAA70" />
      <rect x="182" y="288" width="128" height="20" rx="10" fill="#FDAA70" />
    </svg>
  );
}

export function Logo({ dark = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className={`text-[17px] font-extrabold tracking-[-0.02em] ${dark ? 'text-white' : 'text-ink'}`}>
        IWAT<span className={dark ? 'text-brand-300' : 'text-brand-500'}> POS</span>
      </span>
    </div>
  );
}
