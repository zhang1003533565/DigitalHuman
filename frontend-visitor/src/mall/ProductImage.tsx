import { useState } from 'react'
import { MallIcon } from './MallIcon'

export function ProductImage({ src, name, className, eager = false }: { src?: string | null; name: string; className?: string; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) {
    return <span className={`mall-image-placeholder ${className ?? ''}`}><MallIcon name="box" /><span>{name}</span><small>商品图片待更新</small></span>
  }
  return <img className={className} src={src} alt={name} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedSrc(src)} />
}
