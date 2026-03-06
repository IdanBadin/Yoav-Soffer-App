import type { ActiveView } from '../types'

interface Props {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export function Header({ activeView, onViewChange }: Props) {
  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--sp-3)',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 0 var(--border), 0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-3)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '5px 10px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <img
              src="/logo.png"
              alt="י. סופר מערכות חשמל"
              style={{ height: '32px', width: 'auto', display: 'block' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              י. סופר מערכות חשמל בע"מ
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '1px' }}>
              מערכת ייצור הצעות מחיר
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <NavTab
            label="עיבוד שרטוטים"
            icon={<IconBolt />}
            active={activeView === 'main'}
            onClick={() => onViewChange('main')}
          />
          <NavTab
            label="ניהול מחירון"
            icon={<IconSheet />}
            active={activeView === 'prices'}
            onClick={() => onViewChange('prices')}
          />
        </nav>
      </div>
    </header>
  )
}

function NavTab({
  label, icon, active, onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: 'var(--r-md)',
        border: active ? '1px solid rgba(246,201,14,0.25)' : '1px solid transparent',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.82rem',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function IconBolt() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

function IconSheet() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  )
}
