import type { ActiveView } from '../types'

interface Props {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

export function Header({ activeView, onViewChange }: Props) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background-dark/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-20 items-center">

          {/* Logo + company name */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-xl flex-shrink-0">
              <span className="material-symbols-outlined text-background-dark text-xl font-bold select-none">
                flash_on
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100 leading-tight">
                י. סופר מערכות חשמל בע&quot;מ
              </span>
              <span className="text-xs font-medium text-primary/80 leading-tight hidden sm:block">
                מערכת ייצור הצעות מחיר
              </span>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center gap-2">
            <NavTab
              label="עיבוד שרטוטים"
              icon="bolt"
              active={activeView === 'main'}
              onClick={() => onViewChange('main')}
            />
            <NavTab
              label="ניהול מחירון"
              icon="grid_view"
              active={activeView === 'prices'}
              onClick={() => onViewChange('prices')}
            />
          </div>

        </div>
      </div>
    </nav>
  )
}

function NavTab({
  label, icon, active, onClick,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all',
        active
          ? 'bg-primary text-background-dark'
          : 'text-slate-400 hover:bg-primary/10 hover:text-primary',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[18px] leading-none select-none">
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
