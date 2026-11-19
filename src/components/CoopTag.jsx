import { dispTr } from '../lib.js'
import { resolveBirdCoopId } from '../coops.js'

/**
 * Bir kuşun bulunduğu kümeyi gösteren küçük rozet.
 *
 * Aile bağları (eş, yavru, ebeveyn) kümes sınırını aşabildiği için bu rozet
 * normalde yalnızca "bu kuş başka kümede" bilgisini verir. `always` verilirse
 * kuşun aktif kümesiyle aynı olsa da gösterilir; "Kümes" sütununda kullanılır.
 */
export default function CoopTag({ bird, coops = [], activeCoopId = '', compact = false, always = false }) {
  if (!bird) return null
  if (!always && !activeCoopId) return null
  const id = resolveBirdCoopId(bird, coops)
  if (!id) return null
  if (!always && id === activeCoopId) return null
  const coop = (coops || []).find(c => c.id === id)
  if (!coop) return null

  return (
    <span
      className="coop-badge"
      title={`${coop.name} kümesinde`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '0 5px' : '0 6px',
        borderRadius: 6,
        border: '1px solid var(--line)',
        background: 'var(--panel-2)',
        color: 'var(--muted)',
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        lineHeight: 1.35,
        height: 22,
        whiteSpace: 'nowrap',
        maxWidth: always ? '100%' : compact ? 110 : 150,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        verticalAlign: 'middle',
        flexShrink: 0
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: coop.color || 'var(--muted)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dispTr(coop.name)}</span>
    </span>
  )
}
