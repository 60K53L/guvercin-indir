import React from 'react'
import { trUpper } from '../lib.js'
import { PIGEON_BODY_D, PIGEON_WING_D, PIGEON_BIB_D, PIGEON_EYE } from './pigeonVectorPath.js'

/**
 * 22 Orijinal Güvercin Irk & Renk Varyasyonu Tanımları
 */
export const BREED_CATALOG = [
  // 1. Düz Kostüm / Saya
  { id: 'CAKAL', name: 'ÇAKAL', group: 'Düz Kostüm', file: 'cakal.svg', keywords: ['ÇAKAL', 'CAKAL', 'KESTANE'] },
  { id: 'LIMONI', name: 'LİMONİ', group: 'Düz Kostüm', file: 'limoni.svg', keywords: ['LİMONİ', 'LIMONI', 'LİMON', 'LIMON'] },
  { id: 'BEYAZ', name: 'BEYAZ KOSTÜM', group: 'Düz Kostüm', file: 'beyaz.svg', keywords: ['BEYAZ', 'AK'] },
  { id: 'CIKOLATA_SAYA', name: 'ÇİKOLATA SAYA', group: 'Düz Saya', file: 'cikolata_saya.svg', keywords: ['ÇİKOLATA SAYA', 'CIKOLATA SAYA', 'ÇİKOLATA'] },
  { id: 'JOKER', name: 'JOKER', group: 'Saya', file: 'joker.svg', keywords: ['JOKER'] },
  { id: 'ARAP', name: 'ARAP', group: 'Düz Saya', file: 'arap.svg', keywords: ['ARAP', 'KARA SAYA', 'SİYAH SAYA', 'SIYAH SAYA'] },
  { id: 'KULLU_LIMONI', name: 'KÜLLÜ LİMONİ', group: 'Düz Saya', file: 'kullu_limoni.svg', keywords: ['KÜLLÜ LİMONİ', 'KULLU LIMONI', 'KÜLLÜ SARI', 'KULLU SARI'] },

  // 2. Komple Ailesi
  { id: 'KOMPLE_SARI', name: 'SARI KOMPLE', group: 'Komple', file: 'komple_sari.svg', family: 'KOMPLE', color: 'SARI' },
  { id: 'KULLU_SARI_KOMPLE', name: 'KÜLLÜ SARI KOMPLE', group: 'Komple', file: 'kullu_sari_komple.svg', family: 'KOMPLE', color: 'KULLU_SARI' },
  { id: 'KOMPLE_KIRMIZI', name: 'KIRMIZI KOMPLE', group: 'Komple', file: 'komple_kirmizi.svg', family: 'KOMPLE', color: 'KIRMIZI' },
  { id: 'KOMPLE_MAVI', name: 'MAVİ KOMPLE', group: 'Komple', file: 'komple_mavi.svg', family: 'KOMPLE', color: 'MAVI' },
  { id: 'KOMPLE_KARA', name: 'KARA KOMPLE', group: 'Komple', file: 'komple_kara.svg', family: 'KOMPLE', color: 'KARA' },

  // 3. Bango Ailesi
  { id: 'BANGO_SARI', name: 'SARI BANGO', group: 'Bango', file: 'bango_sari.svg', family: 'BANGO', color: 'SARI' },
  { id: 'BANGO_KIRMIZI', name: 'KIRMIZI BANGO', group: 'Bango', file: 'bango_kirmizi.svg', family: 'BANGO', color: 'KIRMIZI' },
  { id: 'BANGO_MAVI', name: 'MAVİ BANGO', group: 'Bango', file: 'bango_mavi.svg', family: 'BANGO', color: 'MAVI' },
  { id: 'BANGO_KARA', name: 'KARA BANGO', group: 'Bango', file: 'bango_kara.svg', family: 'BANGO', color: 'KARA' },
  { id: 'BANGO_KULLU', name: 'KÜLLÜ BANGO', group: 'Bango', file: 'bango_kullu.svg', family: 'BANGO', color: 'KULLU' },

  // 4. Tip Güvercini
  { id: 'TIP_KIRMIZI', name: 'KIRMIZI TİP', group: 'Tip', file: 'tip_kirmizi.svg', family: 'TIP', color: 'KIRMIZI' },
  { id: 'TIP_MAVI', name: 'MAVİ TİP', group: 'Tip', file: 'tip_mavi.svg', family: 'TIP', color: 'MAVI' },
  { id: 'TIP_CIKOLATA', name: 'ÇİKOLATA TİP', group: 'Tip', file: 'tip_cikolata.svg', family: 'TIP', color: 'CIKOLATA' },
  { id: 'TIP_SARI', name: 'SARI TİP', group: 'Tip', file: 'tip_sari.svg', family: 'TIP', color: 'SARI' },
  { id: 'TIP_KARA', name: 'KARA TİP', group: 'Tip', file: 'tip_kara.svg', family: 'TIP', color: 'KARA' },

  // 5. Mısri Ailesi
  { id: 'MISRI_SARI', name: 'SARI KANAT', group: 'Mısri', file: 'misri_sari.svg', family: 'MISRI', color: 'SARI' },
  { id: 'MISRI_KARA', name: 'KARA KANAT', group: 'Mısri', file: 'misri_kara.svg', family: 'MISRI', color: 'KARA' },
  { id: 'MISRI_KIRMIZI', name: 'KIRMIZI KANAT', group: 'Mısri', file: 'misri_kirmizi.svg', family: 'MISRI', color: 'KIRMIZI' },
  { id: 'MISRI_CIKOLATA', name: 'ÇİKOLATA KANAT', group: 'Mısri', file: 'misri_cikolata.svg', family: 'MISRI', color: 'CIKOLATA' },
  { id: 'MISRI_NUHUDI', name: 'NUHUDİ KANAT', group: 'Mısri', file: 'misri_nuhudi.svg', family: 'MISRI', color: 'NUHUDI' },
  { id: 'MISRI_MAVI', name: 'MAVİ KANAT', group: 'Mısri', file: 'misri_mavi.svg', family: 'MISRI', color: 'MAVI' },
  { id: 'MISRI_SEKERI', name: 'ŞEKERİ KANAT', group: 'Mısri', file: 'misri_sekeri.svg', family: 'MISRI', color: 'SEKERI' },
  { id: 'MISRI_SEKER', name: 'ŞEKER KANAT', group: 'Mısri', file: 'misri_seker.svg', family: 'MISRI', color: 'SEKER' },
  { id: 'MISRI_BEYAZ', name: 'DÜZ BEYAZ MISRİ', group: 'Mısri', file: 'misri_beyaz.svg', family: 'MISRI', color: 'BEYAZ' }
]

/**
 * Verilen ırk/cins metnini 22 orijinal ırk görselinden biriyle eşleştirir.
 */
export function getBreedVisualInfo(cinsi) {
  if (!cinsi) return null
  const txt = trUpper(String(cinsi))

  // 1. "BEYAZ KIRMIZILARDAN" ve "BEYAZ SARILARDAN" özel durumu -> Düz Beyaz Kostüm
  if (
    txt.includes('BEYAZ KIRMIZILARDAN') ||
    txt.includes('BEYAZ SARILARDAN') ||
    txt.includes('BEYAZ KIRMIZILAR') ||
    txt.includes('BEYAZ SARILAR')
  ) {
    return {
      id: 'BEYAZ',
      label: 'Beyaz Kostüm',
      file: 'beyaz.svg'
    }
  }

  // Aile tespiti
  const isKomple = txt.includes('KOMPLE')
  const isBango = txt.includes('BANGO')
  const isTip = txt.includes('TİP') || txt.includes('TIP')
  const isMisri = txt.includes('MISRİ') || txt.includes('MISRI') || txt.includes('KANAT') || txt.includes('ŞEKER') || txt.includes('SEKER')

  // Renk tespiti
  const hasSekeri = txt.includes('ŞEKERİ') || txt.includes('SEKERI')
  const hasSeker = (txt.includes('ŞEKER') || txt.includes('SEKER')) && !hasSekeri
  const hasSari = txt.includes('SARI') || txt.includes('LİMON') || txt.includes('LIMON') || txt.includes('SARI KANAT')
  const hasKara = txt.includes('KARA') || txt.includes('SİYAH') || txt.includes('SIYAH') || txt.includes('ARAP')
  const hasKirmizi = txt.includes('KIRMIZI') || txt.includes('AL')
  const hasMavi = txt.includes('MAVİ') || txt.includes('MAVI') || txt.includes('GÖK') || txt.includes('GOK')
  const hasCikolata = txt.includes('ÇİKOLATA') || txt.includes('CIKOLATA') || txt.includes('KAHVE')
  const hasNuhudi = txt.includes('NUHUDİ') || txt.includes('NUHUDI') || txt.includes('NOHUDİ') || txt.includes('NOHUDI')
  const hasKullu = txt.includes('KÜLLÜ') || txt.includes('KULLU') || txt.includes('DUMAN')
  const hasBeyaz = txt.includes('BEYAZ') || txt.includes('AK')

  // Joker Eşleşmesi
  if (txt.includes('JOKER')) {
    return { id: 'JOKER', label: 'Joker', file: 'joker.svg' }
  }

  // Çikolata Saya Eşleşmesi
  if (
    txt.includes('ÇİKOLATA SAYA') ||
    txt.includes('CIKOLATA SAYA') ||
    (txt.includes('SAYA') && hasCikolata) ||
    txt === 'ÇİKOLATA' ||
    txt === 'CIKOLATA'
  ) {
    return { id: 'CIKOLATA_SAYA', label: 'Çikolata Saya', file: 'cikolata_saya.svg' }
  }

  // Arap (Düz Siyah Saya) Eşleşmesi
  if (
    !isKomple && !isBango && !isTip && !isMisri &&
    (txt.includes('ARAP') ||
     txt.includes('KARA SAYA') ||
     txt.includes('SİYAH SAYA') ||
     txt.includes('SIYAH SAYA') ||
     (txt.includes('SAYA') && hasKara) ||
     txt === 'ARAP')
  ) {
    return { id: 'ARAP', label: 'Arap', file: 'arap.svg' }
  }

  // Küllü Limoni (Düz Küllü Sarı Saya) Eşleşmesi
  if (
    !isKomple && !isBango && !isTip && !isMisri &&
    (txt.includes('KÜLLÜ LİMONİ') ||
     txt.includes('KULLU LIMONI') ||
     txt.includes('KÜLLÜ SARI') ||
     txt.includes('KULLU SARI'))
  ) {
    return { id: 'KULLU_LIMONI', label: 'Küllü Limoni', file: 'kullu_limoni.svg' }
  }

  // 1. Komple Ailesi Eşleşmesi
  if (isKomple) {
    if (hasKullu || txt.includes('KÜLLÜ') || txt.includes('KULLU')) {
      return { id: 'KULLU_SARI_KOMPLE', label: 'Küllü Sarı Komple', file: 'kullu_sari_komple.svg' }
    }
    if (hasSari) return { id: 'KOMPLE_SARI', label: 'Sarı Komple', file: 'komple_sari.svg' }
    if (hasKara) return { id: 'KOMPLE_KARA', label: 'Kara Komple', file: 'komple_kara.svg' }
    if (hasMavi) return { id: 'KOMPLE_MAVI', label: 'Mavi Komple', file: 'komple_mavi.svg' }
    return { id: 'KOMPLE_KIRMIZI', label: 'Kırmızı Komple', file: 'komple_kirmizi.svg' }
  }

  // 2. Bango Ailesi Eşleşmesi
  if (isBango) {
    if (hasSari) return { id: 'BANGO_SARI', label: 'Sarı Bango', file: 'bango_sari.svg' }
    if (hasKirmizi) return { id: 'BANGO_KIRMIZI', label: 'Kırmızı Bango', file: 'bango_kirmizi.svg' }
    if (hasMavi) return { id: 'BANGO_MAVI', label: 'Mavi Bango', file: 'bango_mavi.svg' }
    if (hasKullu) return { id: 'BANGO_KULLU', label: 'Küllü Bango', file: 'bango_kullu.svg' }
    return { id: 'BANGO_KARA', label: 'Kara Bango', file: 'bango_kara.svg' }
  }

  // 3. Tip Güvercini Eşleşmesi
  if (isTip) {
    if (hasMavi) return { id: 'TIP_MAVI', label: 'Mavi Tip', file: 'tip_mavi.svg' }
    if (hasCikolata) return { id: 'TIP_CIKOLATA', label: 'Çikolata Tip', file: 'tip_cikolata.svg' }
    if (hasSari) return { id: 'TIP_SARI', label: 'Sarı Tip', file: 'tip_sari.svg' }
    if (hasKara) return { id: 'TIP_KARA', label: 'Kara Tip', file: 'tip_kara.svg' }
    return { id: 'TIP_KIRMIZI', label: 'Kırmızı Tip', file: 'tip_kirmizi.svg' }
  }

  // 4. Mısri Ailesi Eşleşmesi
  if (isMisri) {
    if (hasSekeri) return { id: 'MISRI_SEKERI', label: 'Şekeri Kanat', file: 'misri_sekeri.svg' }
    if (hasSeker) return { id: 'MISRI_SEKER', label: 'Şeker Kanat', file: 'misri_seker.svg' }
    if (hasMavi) return { id: 'MISRI_MAVI', label: 'Mavi Kanat', file: 'misri_mavi.svg' }
    if (hasKara) return { id: 'MISRI_KARA', label: 'Kara Kanat', file: 'misri_kara.svg' }
    if (hasKirmizi) return { id: 'MISRI_KIRMIZI', label: 'Kırmızı Kanat', file: 'misri_kirmizi.svg' }
    if (hasCikolata) return { id: 'MISRI_CIKOLATA', label: 'Çikolata Kanat', file: 'misri_cikolata.svg' }
    if (hasNuhudi) return { id: 'MISRI_NUHUDI', label: 'Nuhudi Kanat', file: 'misri_nuhudi.svg' }
    if (hasBeyaz || txt.includes('BEYAZ')) return { id: 'MISRI_BEYAZ', label: 'Düz Beyaz Mısri', file: 'misri_beyaz.svg' }
    return { id: 'MISRI_SARI', label: 'Sarı Kanat', file: 'misri_sari.svg' }
  }

  // 5. Düz Renkler (Kostüm)
  if (txt.includes('ÇAKAL') || txt.includes('CAKAL')) {
    return { id: 'CAKAL', label: 'Çakal', file: 'cakal.svg' }
  }
  if (txt.includes('LİMONİ') || txt.includes('LIMONI')) {
    return { id: 'LIMONI', label: 'Limoni', file: 'limoni.svg' }
  }
  if (txt.includes('BEYAZ')) {
    return { id: 'BEYAZ', label: 'Beyaz Kostüm', file: 'beyaz.svg' }
  }

  // 6. Basit Renk Eşleşmeleri (Doğrudan renk yazılmışsa)
  if (hasSari) return { id: 'LIMONI', label: 'Limoni', file: 'limoni.svg' }
  if (hasKirmizi) return { id: 'CAKAL', label: 'Çakal', file: 'cakal.svg' }
  if (hasKara) return { id: 'KOMPLE_KARA', label: 'Kara Komple', file: 'komple_kara.svg' }
  if (hasMavi) return { id: 'KOMPLE_MAVI', label: 'Mavi Komple', file: 'komple_mavi.svg' }

  // Varsayılan / Eşleşmeyen diğer ırklar için vektörel siluet bilgisi döner
  return {
    id: 'DIGER',
    label: cinsi,
    isFallback: true,
    color: '#38bdf8',
    wingColor: '#0284c7'
  }
}

/**
 * Güvercin Cins İkonu
 * 22 orijinal ırk görselini SVG dosyasından yüksek netlikte ve performansla render eder.
 */
export default function BreedIcon({ cinsi, size = 20, style = {} }) {
  const info = getBreedVisualInfo(cinsi)
  if (!info) return null

  // 22 orijinal SVG dosyasından biriyle eşleşmişse
  if (info.file) {
    const baseUrl = import.meta.env?.BASE_URL || './'
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const src = `${cleanBase}breeds/${info.file}`

    return (
      <img
        src={src}
        width={size}
        height={size}
        alt={info.label}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          objectFit: 'contain',
          flexShrink: 0,
          filter: 'drop-shadow(0 0 1px rgba(241,245,249,0.7)) drop-shadow(0 1.5px 2px rgba(0,0,0,0.45))',
          ...style
        }}
        loading="lazy"
        onError={(e) => {
          // İmaj yüklenemezse gizlenip bozuk simge göstermesin
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  // Fallback: Eşleşmeyen diğer ırklar için saf vektörel siluet
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        filter: 'drop-shadow(0 0 1px rgba(241,245,249,0.7)) drop-shadow(0 1.5px 2px rgba(0,0,0,0.45))',
        ...style
      }}
      aria-label={info.label}
    >
      <path
        d={PIGEON_BODY_D}
        fill={info.color || '#38bdf8'}
        stroke="rgba(241,245,249,0.45)"
        strokeWidth="1.2"
      />
      <path
        d={PIGEON_WING_D}
        fill={info.wingColor || 'rgba(0,0,0,0.2)'}
        opacity={0.85}
      />
      <circle
        cx={PIGEON_EYE.cx}
        cy={PIGEON_EYE.cy}
        r={PIGEON_EYE.r}
        fill="#ffffff"
        stroke="#1e293b"
        strokeWidth="0.4"
      />
      <circle
        cx={PIGEON_EYE.cx}
        cy={PIGEON_EYE.cy}
        r={PIGEON_EYE.pupilR}
        fill="#1e2430"
      />
    </svg>
  )
}
