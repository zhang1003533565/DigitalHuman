import { useEffect, useRef, type ReactNode } from 'react'

export function MallDialog({ children, label, className = '', busy = false, onClose }: { children: ReactNode; label: string; className?: string; busy?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog ref={ref} className={`mall-dialog ${className}`} aria-label={label}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
      }}>
      {children}
    </dialog>
  )
}
