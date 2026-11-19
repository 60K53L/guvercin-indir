import { ringChip, dispTr } from '../lib.js'

/**
 * Künye (ring) rozeti.
 *
 * Rengi kuşun renginden türetilir. Metin olarak yazmak yerine DOLU bir
 * rozete çevrildi: zemin kuşun gerçek rengi, yazı o zeminde okunacak
 * siyah ya da beyaz. Böylece SİYAH koyu temada da, BEYAZ açık temada da
 * görünür ve hiçbir renge kontür gerekmez.
 *
 * Renk tanınmıyorsa (ör. "ABC-12") rozet yerine sıradan vurgu renginde
 * metin gösterilir — eski davranış.
 *
 * Künye/klips metni kayıtta büyük harfle durur; görünümde noktalı İ yerine
 * küçük i çizilsin diye yazı dispTr() ile üretilir (bkz. lib.js). Büyük harf
 * gerçekten uygulanan yerlerde CSS zaten devrede olduğundan sonuç değişmez.
 */
export default function Ring({ text, className = 'ring', style, ...rest }) {
  const chip = ringChip(text)
  if (!chip) {
    return (
      <span className={className} style={style} {...rest}>
        {dispTr(text)}
      </span>
    )
  }
  return (
    <span
      className={`${className} ring-chip${chip.isDual ? ' ring-chip-dual' : ''}${chip.isDark ? ' ring-chip-dark' : ''}`}
      data-renk={chip.kelime}
      style={{
        '--chip-bg': chip.dolgu,
        '--chip-fg': chip.yazi,
        ...(chip.textShadow ? { textShadow: chip.textShadow } : {}),
        ...style
      }}
      {...rest}
    >
      {dispTr(text)}
    </span>
  )
}