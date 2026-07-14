import type { ReactNode } from 'react'
import type { AdminPageMeta } from '../adminPageMeta'

export default function AdminPageFrame({ page, children, compact = false }: { page: AdminPageMeta; children: ReactNode; compact?: boolean }) {
  return (
    <section className={`admin-page-frame${compact ? ' admin-page-frame--compact' : ''}`}>
      <header className="admin-page-frame__header">
        <div><span>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></div>
      </header>
      <div className="admin-page-frame__body">{children}</div>
    </section>
  )
}
