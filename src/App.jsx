import { useState, useCallback } from 'react'
import RankineChart from './RankineChart'
import { satT, satTHeaders, satTKeys, satTUnits, satP, satPHeaders, satPKeys, satPUnits, supData, liqData } from './data'
import styles from './App.module.css'

function fmt(v) {
  if (typeof v !== 'number') return v
  if (Math.abs(v) < 0.0001) return v.toExponential(4)
  if (Math.abs(v) < 10) return parseFloat(v.toPrecision(5)).toString()
  return parseFloat(v.toPrecision(6)).toString()
}

// Interpolação Quadrática (Polinômio de Lagrange)
function interpQuad(x0, y0, x1, y1, x2, y2, x) {
  if (x0 === x1 || x1 === x2 || x0 === x2) return y1;
  const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  return y0 * L0 + y1 * L1 + y2 * L2;
}

function findThreePoints(arr, val, idx) {
  let lo = -1;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i][idx] <= val && arr[i + 1][idx] >= val) { lo = i; break; }
  }
  if (lo === -1) return [-1, -1, -1];
  if (lo === 0) return [0, 1, 2];
  if (lo === arr.length - 2) return [lo - 1, lo, lo + 1];
  return Math.abs(val - arr[lo - 1][idx]) < Math.abs(val - arr[lo + 2][idx]) ? [lo - 1, lo, lo + 1] : [lo, lo + 1, lo + 2];
}

function findClosestTable(dataObj, targetVal) {
  const keys = Object.keys(dataObj);
  let closestKey = keys[0];
  let minDiff = Math.abs(Number(closestKey) - targetVal);
  for (let k of keys) {
    const diff = Math.abs(Number(k) - targetVal);
    if (diff < minDiff) { minDiff = diff; closestKey = k; }
  }
  return { key: closestKey, table: dataObj[closestKey] };
}

export default function App() {
  const [inputP, setInputP] = useState('')
  const [inputT, setInputT] = useState('')
  const [result, setResult] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [tableInfo, setTableInfo] = useState(null)
  const [highlightVal, setHighlightVal] = useState(null)

  const handleSearch = useCallback(() => {
    setResult(null); setAnalysis(null); setHighlightVal(null); setTableInfo(null);
    const P = parseFloat(inputP);
    const T = parseFloat(inputT);
    const hasP = !isNaN(P);
    const hasT = !isNaN(T);

    if (!hasP && !hasT) { alert("Insira Pressão e/ou Temperatura."); return; }

    let estado = ""; let memorial = []; let rowData = []; 
    let keys = []; let units = []; let currentT = 0; let s_val = null;

    // Fórmulas base para o memorial
    const formulaLagrange = "y(x) = y₀·L₀ + y₁·L₁ + y₂·L₂ | Lᵢ = Π (x-xⱼ)/(xᵢ-xⱼ)";

    if (hasT && !hasP) {
      const pts = findThreePoints(satT, T, 0);
      if (pts[0] === -1) { setResult({ error: "Temperatura fora da tabela (0.01 a 374.14 °C)." }); return; }
      rowData = satTKeys.map((_, i) => interpQuad(satT[pts[0]][0], satT[pts[0]][i], satT[pts[1]][0], satT[pts[1]][i], satT[pts[2]][0], satT[pts[2]][i], T));
      keys = satTKeys; units = satTUnits; currentT = T; s_val = [rowData[6], rowData[7]];
      
      setTableInfo({ headers: satTHeaders, rows: satT, keyIdx: 0 });
      setHighlightVal(T);
      setAnalysis({ 
        estado: "SATURADA POR TEMPERATURA", color: "var(--accent)", T: currentT, s_val,
        memorial: [
          `1. Variável Independente: T = ${T} °C`,
          `2. Condição assumida: Linha de saturação (P = Psat, T = Tsat)`,
          `3. Cálculo de Psat via Polinômio de Lagrange (Interpolação Quadrática):`,
          `   ↳ Fórmula: ${formulaLagrange}`,
          `   ↳ Resultado: Psat = f(${T}) = ${fmt(rowData[1])} bar.`
        ]
      });
    }
    else if (hasP && !hasT) {
      const pts = findThreePoints(satP, P, 0);
      if (pts[0] === -1) { setResult({ error: "Pressão fora da tabela (0.00611 a 220.9 bar)." }); return; }
      rowData = satPKeys.map((_, i) => interpQuad(satP[pts[0]][0], satP[pts[0]][i], satP[pts[1]][0], satP[pts[1]][i], satP[pts[2]][0], satP[pts[2]][i], P));
      keys = satPKeys; units = satPUnits; currentT = rowData[1]; s_val = [rowData[6], rowData[7]];
      
      setTableInfo({ headers: satPHeaders, rows: satP, keyIdx: 0 });
      setHighlightVal(P);
      setAnalysis({ 
        estado: "SATURADA POR PRESSÃO", color: "var(--accent)", T: currentT, s_val,
        memorial: [
          `1. Variável Independente: P = ${P} bar`,
          `2. Condição assumida: Linha de saturação (T = Tsat, P = Psat)`,
          `3. Cálculo de Tsat via Polinômio de Lagrange (Interpolação Quadrática):`,
          `   ↳ Fórmula: ${formulaLagrange}`,
          `   ↳ Resultado: Tsat = f(${P}) = ${fmt(rowData[1])} °C.`
        ]
      });
    }
    else if (hasP && hasT) {
      const ptsP = findThreePoints(satP, P, 0);
      if (ptsP[0] === -1) { setResult({ error: "Pressão fora dos limites." }); return; }
      
      const Tsat = interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][1], satP[ptsP[1]][0], satP[ptsP[1]][1], satP[ptsP[2]][0], satP[ptsP[2]][1], P);
      memorial.push(`1. Entradas Analisadas: P = ${P} bar | T = ${T} °C`);
      memorial.push(`2. Cálculo da fronteira de fase (Tsat) via Interpolação Quadrática:`);
      memorial.push(`   ↳ ${formulaLagrange} ➔ Tsat = ${fmt(Tsat)} °C`);

      if (T > Tsat + 0.1) {
        estado = "VAPOR SUPERAQUECIDO";
        memorial.push(`3. Critério Termodinâmico Aplicado:`);
        memorial.push(`   ↳ T_sistema > Tsat ➔ (${T} °C > ${fmt(Tsat)} °C)`);
        
        const { key, table } = findClosestTable(supData, P);
        memorial.push(`4. Obtenção de Propriedades: Tabela de vapor mais próxima (P_ref = ${key} bar).`);
        
        const ptsT = findThreePoints(table.rows, T, 0);
        if (ptsT[0] === -1) { setResult({ error: `T = ${T}°C está fora da tabela.` }); return; }
        
        rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], T));
        keys = ['T','v','h','s']; units = ['°C','m³/kg','kJ/kg','kJ/kg·K'];
        setTableInfo({ headers: table.headers, rows: table.rows, keyIdx: 0 });
        setHighlightVal(T);
        setAnalysis({ estado, color: "var(--amber)", memorial, T, s_val: rowData[3] });
      }
      else if (T < Tsat - 0.1) {
        estado = "LÍQUIDO COMPRIMIDO";
        memorial.push(`3. Critério Termodinâmico Aplicado:`);
        memorial.push(`   ↳ T_sistema < Tsat ➔ (${T} °C < ${fmt(Tsat)} °C)`);
        
        const { key, table } = findClosestTable(liqData, P / 10);
        memorial.push(`4. Obtenção de Propriedades: Tabela de líquido mais próxima (P_ref = ${key} MPa).`);
        
        const ptsT = findThreePoints(table.rows, T, 0);
        if (ptsT[0] === -1) { setResult({ error: `T = ${T}°C está fora da tabela.` }); return; }
        
        rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], T));
        keys = ['T','v','h','s']; units = ['°C','m³/kg','kJ/kg','kJ/kg·K'];
        setTableInfo({ headers: table.headers, rows: table.rows, keyIdx: 0 });
        setHighlightVal(T);
        setAnalysis({ estado, color: "var(--accent)", memorial, T, s_val: rowData[3] });
      }
      else {
        estado = "MISTURA SATURADA";
        memorial.push(`3. Critério Termodinâmico Aplicado:`);
        memorial.push(`   ↳ T_sistema ≅ Tsat ➔ (${T} °C ≅ ${fmt(Tsat)} °C)`);
        memorial.push(`4. Obtenção de Propriedades: Extracção das linhas de saturação (líquido vf e vapor vg).`);
        
        rowData = satPKeys.map((_, i) => interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][i], satP[ptsP[1]][0], satP[ptsP[1]][i], satP[ptsP[2]][0], satP[ptsP[2]][i], P));
        keys = satPKeys; units = satPUnits;
        setTableInfo({ headers: satPHeaders, rows: satP, keyIdx: 0 });
        setHighlightVal(P);
        setAnalysis({ estado, color: "var(--green)", memorial, T: rowData[1], s_val: [rowData[6], rowData[7]] });
      }
    }
    setResult({ keys, units, values: rowData, title: `Resultado Extraído` });
  }, [inputP, inputT]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>H₂O</span>
            <div>
              <div className={styles.logoTitle}>Tabelas Termodinâmicas</div>
              <div className={styles.logoSub}>Propriedades da Água e Vapor</div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.searchBar}>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>PRESSÃO (bar)</label>
            <div className={styles.searchInput}>
              <input
                type="number"
                value={inputP}
                onChange={e => setInputP(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ex: 5.0"
              />
            </div>
          </div>
          
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>TEMPERATURA (°C)</label>
            <div className={styles.searchInput}>
              <input
                type="number"
                value={inputT}
                onChange={e => setInputT(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ex: 300"
              />
              <button onClick={handleSearch} style={{marginLeft: '10px'}}>Buscar</button>
            </div>
          </div>
        </div>

        {result && result.error && (
          <div className={`${styles.resultCard} ${styles.resultError}`}>
            <p className={styles.errorMsg}>{result.error}</p>
          </div>
        )}

        {/* MEMORIAL DE CÁLCULO COM FÓRMULAS */}
        {analysis && (
          <div className={styles.resultCard} style={{ borderLeft: `4px solid ${analysis.color}` }}>
            <div className={styles.resultHeader}>
              <span className={styles.resultTitle} style={{ color: analysis.color, fontSize: '15px' }}>
                STATUS: {analysis.estado}
              </span>
              <span className={styles.interpBadge}>interpolação quadrática</span>
            </div>
            <div className={styles.memorialText}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '8px'}}>MEMORIAL DE CÁLCULO (Equações e Lógica):</strong>
              {analysis.memorial.map((line, i) => (
                <p key={i} className={styles.memorialLine}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultTitle}>PROPRIEDADES EXTRAÍDAS</span>
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
          </div>
        )}

        {analysis && (
          <div className={styles.resultCard} style={{ padding: '0', overflow: 'hidden' }}>
            <RankineChart analysis={analysis} />
          </div>
        )}

        {tableInfo && tableInfo.headers && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {tableInfo.headers.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableInfo.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={highlightVal !== null && row[tableInfo.keyIdx] === highlightVal ? styles.highlighted : ''}
                  >
                    {row.map((v, ci) => <td key={ci}>{fmt(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        Desenvolvido por: <strong style={{color: 'var(--text)'}}>Murilo Roberto Matias da Silva</strong> | Matrícula: 30313473
      </footer>
    </div>
  )
}