import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/* ---------- Button ---------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }
>(function Button({ variant = 'secondary', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(size === 'sm' ? 'px-2 py-0.5 text-xs' : '', variant === 'primary' && 'btn-primary', variant === 'secondary' && 'btn-secondary', variant === 'ghost' && 'btn-ghost', variant === 'danger' && 'btn-danger', className)}
      {...props}
    />
  )
})

/* ---------- Input ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('input-base w-full', className)} {...props} />
})

/* ---------- Textarea ---------- */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={cn('input-base w-full font-mono text-[12.5px]', className)} {...props} />
})

/* ---------- Select ---------- */

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn('input-base cursor-pointer pr-6', className)} style={{ backgroundImage: 'none' }} {...props}>
      {children}
    </select>
  )
})

/* ---------- Badge ---------- */

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide', className)}
      style={color ? { color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` } : undefined}
    >
      {children}
    </span>
  )
}

/* ---------- Toggle ---------- */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative w-8 h-[18px] rounded-full transition-colors duration-100 border', checked ? 'bg-primary border-primary' : 'bg-elevated border-border')}
      >
        <span
          className={cn('absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-all duration-100', checked ? 'left-[18px]' : 'left-[2px]')}
        />
      </button>
      {label && <span className="text-xs text-txt-secondary">{label}</span>}
    </label>
  )
}

/* ---------- Checkbox ---------- */

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors', checked ? 'bg-primary border-primary' : 'border-border-strong bg-input')}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

/* ---------- Spinner ---------- */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- EmptyState ---------- */

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12 gap-2">
      {icon && <div className="text-txt-muted mb-1">{icon}</div>}
      <div className="text-sm font-medium text-txt">{title}</div>
      {description && <div className="text-xs text-txt-secondary max-w-sm">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative panel shadow-xl max-h-[85vh] flex flex-col', wide ? 'w-[720px]' : 'w-[440px]')}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="btn-ghost !p-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Tabs ---------- */

export interface TabDef {
  id: string
  label: string
  badge?: ReactNode
  dirty?: boolean
}

export function Tabs({
  tabs,
  active,
  onChange,
  onClose,
  className
}: {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
  onClose?: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center border-b border-border bg-sidebar overflow-x-auto', className)}>
      {tabs.map((t) => (
        <div
          key={t.id}
          className={cn(
            'group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-border whitespace-nowrap transition-colors',
            active === t.id ? 'bg-panel text-txt border-t-2 border-t-primary' : 'text-txt-secondary hover:bg-hover border-t-2 border-t-transparent'
          )}
          onClick={() => onChange(t.id)}
        >
          <span>{t.label}</span>
          {t.dirty && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
          {onClose && (
            <button
              className="opacity-0 group-hover:opacity-100 ml-1 text-txt-muted hover:text-txt !p-0 w-4 h-4 flex items-center justify-center rounded hover:bg-elevated"
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.id)
              }}
              aria-label={`Close ${t.label}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------- Sub tabs (in-panel) ---------- */

export function SubTabs({
  tabs,
  active,
  onChange
}: {
  tabs: Array<{ id: string; label: string; badge?: ReactNode }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-0 border-b border-border px-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={cn(
            'px-2.5 py-1.5 text-xs border-b-2 -mb-px transition-colors',
            active === t.id ? 'border-primary text-txt font-medium' : 'border-transparent text-txt-secondary hover:text-txt'
          )}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge !== undefined && <span className="ml-1 text-2xs text-txt-muted">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- Kbd ---------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1 py-0.5 rounded bg-elevated border border-border text-2xs font-mono text-txt-secondary">{children}</kbd>
}

/* ---------- Toolbar label ---------- */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn('block text-2xs font-medium text-txt-secondary uppercase tracking-wider mb-1', className)}>{children}</label>
}
