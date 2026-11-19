import { SEX, ringOf, byId, dispTr, externalParentText } from '../lib.js'
import Ring from './Ring.jsx'

function Node({ bird, subject, onOpen, role, emptyLabel }) {
  if (!bird) {
    return (
      <div className="ped-card-wrap">
        {role ? <div className="ped-role-label">{dispTr(role)}</div> : null}
        <div className="ped-node empty">
          <span className="ped-empty-text">{dispTr(emptyLabel || 'BİLİNMİYOR')}</span>
        </div>
      </div>
    )
  }

  const cinsi = bird.cinsi || bird.line

  return (
    <div className="ped-card-wrap">
      {role ? (
        <div className={`ped-role-label ${bird.sex === 'F' ? 'role-female' : bird.sex === 'M' ? 'role-male' : ''}`}>
          {dispTr(role)}
        </div>
      ) : null}
      <div
        className={`ped-node${subject ? ' subject' : ''}`}
        onClick={() => onOpen && onOpen(bird.id)}
        role="button"
        tabIndex={0}
      >
        <div className="r">
          <Ring text={ringOf(bird)} />
          {bird.name && bird.name !== ringOf(bird) ? (
            <span className="ped-name">{dispTr(` · ${bird.name}`)}</span>
          ) : null}
        </div>
        <div className="ped-sub">
          <span className={`ped-sex-tag ${bird.sex === 'F' ? 'tag-female' : bird.sex === 'M' ? 'tag-male' : ''}`}>
            {dispTr(SEX[bird.sex] || '—')}
          </span>
          {bird.birthDate ? <span className="ped-year">{bird.birthDate.slice(0, 4)}</span> : null}
          {cinsi ? <span className="ped-cinsi" title={dispTr(cinsi)}>{dispTr(cinsi)}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** 3 kuşak (kendi + anne/baba + dedeler) soy şeması. Önce ANNE, sonra BABA listelenir. */
export default function Pedigree({ birds, bird, onOpen }) {
  const dam = byId(birds, bird.damId)
  const sire = byId(birds, bird.sireId)

  const damDam = byId(birds, dam?.damId)
  const damSire = byId(birds, dam?.sireId)
  const sireDam = byId(birds, sire?.damId)
  const sireSire = byId(birds, sire?.sireId)

  return (
    <div className="pedigree">
      <div className="ped-row">
        {/* KUŞ (KENDİSİ) */}
        <div className="ped-gen ped-col-subject">
          <div className="ped-title">{dispTr('KUŞ')}</div>
          <div className="ped-gen-body ped-body-subject">
            <Node bird={bird} subject role="KUŞ (KENDİSİ)" onOpen={onOpen} />
          </div>
        </div>

        {/* 1. NESİL (ANNE & BABA) */}
        <div className="ped-gen ped-col-parents">
          <div className="ped-title">{dispTr('1. NESİL')}</div>
          <div className="ped-gen-body ped-body-parents">
            <div className="ped-parent-branch">
              <Node
                bird={dam}
                role="ANNE"
                onOpen={onOpen}
                emptyLabel={externalParentText(bird, 'dam') || 'ANNE BİLİNMİYOR'}
              />
            </div>
            <div className="ped-parent-branch">
              <Node
                bird={sire}
                role="BABA"
                onOpen={onOpen}
                emptyLabel={externalParentText(bird, 'sire') || 'BABA BİLİNMİYOR'}
              />
            </div>
          </div>
        </div>

        {/* 2. NESİL (DEDELER & NİNELER) */}
        <div className="ped-gen ped-col-grandparents">
          <div className="ped-title">{dispTr('2. NESİL')}</div>
          <div className="ped-gen-body ped-body-grandparents">
            <div className="ped-grand-branch">
              <Node
                bird={damDam}
                role="ANNENİN ANNESİ"
                onOpen={onOpen}
                emptyLabel={dam ? (externalParentText(dam, 'dam') || 'BİLİNMİYOR') : 'BİLİNMİYOR'}
              />
              <Node
                bird={damSire}
                role="ANNENİN BABASI"
                onOpen={onOpen}
                emptyLabel={dam ? (externalParentText(dam, 'sire') || 'BİLİNMİYOR') : 'BİLİNMİYOR'}
              />
            </div>
            <div className="ped-grand-branch">
              <Node
                bird={sireDam}
                role="BABANIN ANNESİ"
                onOpen={onOpen}
                emptyLabel={sire ? (externalParentText(sire, 'dam') || 'BİLİNMİYOR') : 'BİLİNMİYOR'}
              />
              <Node
                bird={sireSire}
                role="BABANIN BABASI"
                onOpen={onOpen}
                emptyLabel={sire ? (externalParentText(sire, 'sire') || 'BİLİNMİYOR') : 'BİLİNMİYOR'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
