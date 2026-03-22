import { useState, useCallback } from 'react'
import RankineChart from './RankineChart'
import {
  satT, satTHeaders, satTKeys, satTUnits,
  satP, satPHeaders, satPKeys, satPUnits,
  supData, liqData
} from './data'
import styles from './App.module.css'

function fmt(v) {
  if (typeof v !== 'number') return v
  if (Math.abs(v) < 0.0001) return v.toExponential(4)
  if (Math.abs(v) < 10) return parseFloat(v.toPrecision(5)).toString()
  return parseFloat(v.toPrecision(6)).toString()
}

// Interpolação Quadrática (Polinômio de Lagrange)
function interpQuad(x0, y0, x1, y1, x2, y2, x) {
  const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  return y0 * L0 + y1 * L1 + y2 * L2;
}

// Busca de 3 pontos para a quadrática
function findThreePoints(arr, val, idx) {
  let lo = -1;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i][idx] <= val && arr[i + 1][idx] >= val) { lo = i; break; }
  }
  if (lo === -1) return [-1, -1, -1];
  
  if (lo === 0) return [0, 1, 2];
  if (lo === arr.length - 2) return [lo - 1, lo, lo + 1];
  
  if (Math.abs(val - arr[lo - 1][idx]) < Math.abs(val - arr[lo + 2][idx])) {
    return [lo - 1, lo, lo + 1];
  }
  return [lo, lo + 1, lo + 2];
}

const TABS = [
  { id: 'sat-t', label: 'Saturada por Temperatura' },
  { id: 'sat-p', label: 'Saturada por Pressão' },
  { id: 'sup',   label: 'Vapor Superaquecido' },
  { id: 'liq',   label: 'Líquido Comprimido' },
]

export default function App() {
  const [tab, setTab] = useState('sat-t')
  const [searchVal, setSearchVal] = useState('')
  const [supKey, setSupKey] = useState(Object.keys(supData)[0])
  const [liqKey, setLiqKey] = useState(Object.keys(liqData)[0])
  const [result, setResult] = useState(null)
  const [highlightVal, setHighlightVal] = useState(null)
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSearch = useCallback(() => {
    const val = parseFloat(searchVal)
    if (isNaN(val)) { alert('Insira um valor numérico válido.'); return }
    setHighlightVal(val)

    if (tab === 'sat-t') {
      const pts = findThreePoints(satT, val, 0)
      if (pts[0] === -1) { setResult({ error: `Fora do intervalo: 0.01 – 374.14 °C` }); return }
      const [p0, p1, p2] = pts;
      const row = satT[p0][0] === val ? satT[p0] : satT[p1][0] === val ? satT[p1] :
        satTKeys.map((_, i) => interpQuad(satT[p0][0], satT[p0][i], satT[p1][0], satT[p1][i], satT[p2][0], satT[p2][i], val))
      const interped = satT[p0][0] !== val && satT[p1][0] !== val;
      setResult({ title: `T = ${val} °C`, interped, keys: satTKeys, units: satTUnits, values: row, rawVal: val })
    
    } else if (tab === 'sat-p') {
      const pts = findThreePoints(satP, val, 0)
      if (pts[0] === -1) { setResult({ error: `Fora do intervalo: 0.00611 – 220.9 bar` }); return }
      const [p0, p1, p2] = pts;
      const row = satP[p0][0] === val ? satP[p0] : satP[p1][0] === val ? satP[p1] :
        satPKeys.map((_, i) => interpQuad(satP[p0][0], satP[p0][i], satP[p1][0], satP[p1][i], satP[p2][0], satP[p2][i], val))
      const interped = satP[p0][0] !== val && satP[p1][0] !== val;
      setResult({ title: `P = ${val} bar`, interped, keys: satPKeys, units: satPUnits, values: row, rawVal: row[1] })
    
    } else if (tab === 'sup') {
      const d = supData[supKey]
      const pts = findThreePoints(d.rows, val, 0)
      if (pts[0] === -1) { setResult({ error: `Fora do intervalo para P = ${supKey} bar` }); return }
      const [p0, p1, p2] = pts;
      const row = d.rows[p0][0] === val ? d.rows[p0] : d.rows[p1][0] === val ? d.rows[p1] :
        [0,1,2,3].map(i => interpQuad(d.rows[p0][0], d.rows[p0][i], d.rows[p1][0], d.rows[p1][i], d.rows[p2][0], d.rows[p2][i], val))
      const interped = d.rows[p0][0] !== val && d.rows[p1][0] !== val;
      setResult({ title: `P = ${supKey} bar, T = ${val} °C`, interped, keys: ['T','v','h','s'], units: ['°C','m³/kg','kJ/kg','kJ/kg·K'], values: row, rawVal: val })
    
    } else {
      const d = liqData[liqKey]
      const pts = findThreePoints(d.rows, val, 0)
      if (pts[0] === -1) { setResult({ error: `Fora do intervalo para P = ${liqKey} MPa` }); return }
      const [p0, p1, p2] = pts;
      const row = d.rows[p0][0] === val ? d.rows[p0] : d.rows[p1][0] === val ? d.rows[p1] :
        [0,1,2,3].map(i => interpQuad(d.rows[p0][0], d.rows[p0][i], d.rows[p1][0], d.rows[p1][i], d.rows[p2][0], d.rows[p2][i], val))
      const interped = d.rows[p0][0] !== val && d.rows[p1][0] !== val;
      setResult({ title: `P = ${liqKey} MPa, T = ${val} °C`, interped, keys: ['T','v','h','s'], units: ['°C','m³/kg','kJ/kg','kJ/kg·K'], values: row, rawVal: val })
    }
  }, [tab, searchVal, supKey, liqKey])

  const handleTabChange = (t) => {
    setTab(t); setResult(null); setSearchVal(''); setHighlightVal(null);
    setIsMenuOpen(false);
  }

  const tableData = () => {
    if (tab === 'sat-t') return { headers: satTHeaders, rows: satT, keyIdx: 0 }
    if (tab === 'sat-p') return { headers: satPHeaders, rows: satP, keyIdx: 0 }
    if (tab === 'sup') { const d = supData[supKey]; return { headers: d.headers, rows: d.rows, keyIdx: 0 } }
    const d = liqData[liqKey]; return { headers: d.headers, rows: d.rows, keyIdx: 0 }
  }

  const { headers, rows, keyIdx } = tableData()
  const activeTabLabel = TABS.find(t => t.id === tab).label;

  return (
    <div className={styles.app}>
      
      {isMenuOpen && <div className={styles.overlay} onClick={() => setIsMenuOpen(false)}></div>}

      <div className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Navegação</span>
          <button className={styles.closeBtn} onClick={() => setIsMenuOpen(false)}>✕</button>
        </div>
        <nav className={styles.sidebarNav}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.navItem} ${tab === t.id ? styles.navItemActive : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>H₂O</span>
            <div>
              <div className={styles.logoTitle}>Tabelas Termodinâmicas</div>
              <div className={styles.logoSub}>Propriedades da Água e Vapor</div>
            </div>
          </div>
          <button className={styles.hamburgerBtn} onClick={() => setIsMenuOpen(true)}>☰</button>
        </div>
      </header>

      <main className={styles.main}>
        
        <div className={styles.searchBar}>
          <h2 className={styles.activeCategoryTitle}>{activeTabLabel}</h2>

          <div className={styles.searchInputsWrapper}>
            {(tab === 'sup') && (
              <div className={styles.searchGroup}>
                <label className={styles.searchLabel}>Pressão</label>
                <select value={supKey} onChange={e => { setSupKey(e.target.value); setResult(null); setHighlightVal(null) }}>
                  {Object.keys(supData).map(k => <option key={k} value={k}>{k} bar</option>)}
                </select>
              </div>
            )}
            {(tab === 'liq') && (
              <div className={styles.searchGroup}>
                <label className={styles.searchLabel}>Pressão</label>
                <select value={liqKey} onChange={e => { setLiqKey(e.target.value); setResult(null); setHighlightVal(null) }}>
                  {Object.keys(liqData).map(k => <option key={k} value={k}>{k} MPa</option>)}
                </select>
              </div>
            )}
            <div className={styles.searchGroup}>
              <label className={styles.searchLabel}>
                {tab === 'sat-t' ? 'Temperatura (°C)' : tab === 'sat-p' ? 'Pressão (bar)' : 'Temperatura (°C)'}
              </label>
              <div className={styles.searchInput}>
                <input
                  type="number"
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={tab === 'sat-t' ? 'ex: 120' : tab === 'sat-p' ? 'ex: 5.0' : 'ex: 300'}
                />
                <button onClick={handleSearch}>Buscar</button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className={`${styles.resultCard} ${result.error ? styles.resultError : ''}`}>
            {result.error ? (
              <p className={styles.errorMsg}>{result.error}</p>
            ) : (
              <>
                <div className={styles.resultHeader}>
                  <span className={styles.resultTitle}>{result.title}</span>
                  {result.interped && <span className={styles.interpBadge} style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: '#10b981'}}>interpolação quadrática</span>}
                </div>
                <div className={styles.resultGrid}>
                  {result.keys.map((k, i) => (
                    <div key={k} className={styles.resultItem}>
                      <div className={styles.resultLabel}>{k}</div>
                      <div className={styles.resultVal}>{fmt(result.values[i])}</div>
                      <div className={styles.resultUnit}>{result.units[i]}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Dashboard Lado a Lado */}
        <div className={styles.dashboardGrid}>
          
          <div className={styles.chartWrapper}>
             {/* Importante: O arquivo RankineChart.jsx continua o mesmo do passo anterior! */}
             <RankineChart currentResult={result} currentTab={tab} />
          </div>

          <div className={`${styles.tableWrap} ${styles.tableScroll}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {headers.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={highlightVal !== null && row[keyIdx] === highlightVal ? styles.highlighted : ''}
                  >
                    {row.map((v, ci) => <td key={ci}>{fmt(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <footer style={{
        textAlign: 'center', padding: '24px 20px', color: 'var(--text3)', fontSize: '13px',
        fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', marginTop: 'auto', letterSpacing: '0.05em'
      }}>
        Desenvolvido por: <strong style={{color: 'var(--text)'}}>Murilo Roberto Matias da Silva</strong> | Matrícula: 30313473
      </footer>
    </div>
  )
}