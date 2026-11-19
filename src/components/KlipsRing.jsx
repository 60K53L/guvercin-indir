import Ring from './Ring.jsx'
import { fitFontSize } from '../fitText.js'

/**
 * Sol / Sağ ayak klips kartı.
 *
 * İki ayakta da AYNI genişlikte durur; uzun klips adları karta sığacak
 * şekilde gerçek metin ölçümüyle küçülür (bkz. fitText.js). Böylece
 * "BEYAZ-TURUNCU KLİPS" ile "BEYAZ KLİPS" kartları birbirine eşit genişlikte
 * ve hizalı görünür.
 */

export const KLIPS_RING_WIDTH = 200
export const KLIPS_RING_INNER = 184 // 200 - 16px iç boşluk

export default function KlipsRing({ text, className = '', style = {} }) {
  const value = String(text || '')
  const fontSize = value ? fitFontSize(value, KLIPS_RING_INNER, { max: 12, min: 9 }) : 12
  return (
    <Ring
      text={value}
      className={`ring klips-ring ${className}`}
      style={{ fontSize, ...style }}
    />
  )
}
