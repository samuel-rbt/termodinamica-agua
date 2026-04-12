import { useState, useCallback, useMemo } from 'react'
import RankineChart from './RankineChart'
import { satT, satP, supData, liqData } from './data'
import styles from './App.module.css'

function fmt(v) {
  if (typeof v !== 'number' || isNaN(v)) return v;
  if (Math.abs(v) < 0.0001 && v !== 0) return v.toExponential(4);
  if (Math.abs(v) > 9999) return parseFloat(v.toFixed(2)).toString(); 
  if (Math.abs(v) < 10) return parseFloat(v.toPrecision(5)).toString();
  return parseFloat(v.toPrecision(6)).toString();
}

function interpQuad(x0, y0, x1, y1, x2, y2, x) {
  if (x0 === x1 || x1 === x2 || x0 === x2) return y1;
  const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  return y0 * L0 + y1 * L1 + y2 * L2;
}

function generateCalcSteps(x0, y0, x1, y1, x2, y2, x, yName="y") {
  if (x0 === x1 || x1 === x2 || x0 === x2) return ["Erro: Pontos inválidos."];
  const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  const y = y0 * L0 + y1 * L1 + y2 * L2;

  return [
    `[INTERPOLAÇÃO / EXTRAPOLAÇÃO DE LAGRANGE]`,
    `➤ Pontos Base (x, y): P₀(${fmt(x0)}, ${fmt(y0)}), P₁(${fmt(x1)}, ${fmt(y1)}), P₂(${fmt(x2)}, ${fmt(y2)})`,
    `➤ Resolução: ${yName} = (y₀ × L₀) + (y₁ × L₁) + (y₂ × L₂) = ${fmt(y)}`
  ];
}

function findThreePoints(arr, val, idx) {
  if (val <= arr[0][idx]) return [0, 1, 2];
  if (val >= arr[arr.length - 1][idx]) return [arr.length - 3, arr.length - 2, arr.length - 1];
  let lo = -1;
  for (let i = 0; i < arr.length - 1; i++) { 
    if (arr[i][idx] <= val && arr[i + 1][idx] >= val) { lo = i; break; } 
  }
  return lo === 0 ? [0, 1, 2] : [lo - 1, lo, lo + 1];
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
  const [inputP, setInputP] = useState('');
  const [inputT, setInputT] = useState('');
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [tableConfig, setTableConfig] = useState(null);

  const handleSearch = useCallback(() => {
    setResult(null); setAnalysis(null); setTableConfig(null);
    
    const valKpa = parseFloat(inputP); 
    const valT = parseFloat(inputT); 
    const hasP = !isNaN(valKpa);
    const hasT = !isNaN(valT);

    if (!hasP && !hasT) { alert("Insira Pressão (kPa) e/ou Temperatura (°C)."); return; }

    if (hasT && !hasP) {
      const pts = findThreePoints(satT, valT, 0);
      const steps = generateCalcSteps(satT[pts[0]][0], satT[pts[0]][1], satT[pts[1]][0], satT[pts[1]][1], satT[pts[2]][0], satT[pts[2]][1], valT, "Psat (bar)");
      const rowData = satT[pts[0]][0] === valT ? [...satT[pts[0]]] : satT[pts[1]][0] === valT ? [...satT[pts[1]]] :
        [0,1,2,3,4,5,6,7].map(i => interpQuad(satT[pts[0]][0], satT[pts[0]][i], satT[pts[1]][0], satT[pts[1]][i], satT[pts[2]][0], satT[pts[2]][i], valT));
      
      const pBar = rowData[1];
      const pKpa = pBar * 100; // 1 bar = 100 kPa
      
      // Fórmula da Energia Interna simplificada com kPa
      const uf = rowData[4] - (pKpa * rowData[2]);
      const ug = rowData[5] - (pKpa * rowData[3]);

      setAnalysis({ 
        estado: "MISTURA SATURADA", color: "var(--accent)", 
        memorial: [`[ENTRADA] Temperatura T = ${valT} °C`, ...steps, `\n[ENERGIA INTERNA] Calculada via u = h - Pv`, `[CONVERSÃO] Psat = ${fmt(pBar)} bar = ${fmt(pKpa)} kPa`], 
        T: valT, s_val: [rowData[6], rowData[7]], 
        u_str: `uf: ${fmt(uf)} | ug: ${fmt(ug)}`, h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}`
      });
      
      setResult({ 
        title: `Resultados para T = ${valT} °C`, interped: satT[pts[0]][0] !== valT, rawVal: valT,
        keys: ['T', 'P', 'vf', 'vg', 'uf', 'ug', 'hf', 'hg', 'sf', 'sg'], 
        units: ['°C', 'kPa', 'm³/kg', 'm³/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg·K', 'kJ/kg·K'], 
        values: [valT, pKpa, rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] 
      });
      setTableConfig({ type: 'sat-t', highlightVal: valT, calculatedRow: [valT, pKpa, rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] });
    
    } else if (hasP && !hasT) {
      const valBar = valKpa / 100; // kPa para bar
      const pts = findThreePoints(satP, valBar, 0);
      const steps = generateCalcSteps(satP[pts[0]][0], satP[pts[0]][1], satP[pts[1]][0], satP[pts[1]][1], satP[pts[2]][0], satP[pts[2]][1], valBar, "Tsat (°C)");
      const rowData = satP[pts[0]][0] === valBar ? [...satP[pts[0]]] : satP[pts[1]][0] === valBar ? [...satP[pts[1]]] :
        [0,1,2,3,4,5,6,7].map(i => interpQuad(satP[pts[0]][0], satP[pts[0]][i], satP[pts[1]][0], satP[pts[1]][i], satP[pts[2]][0], satP[pts[2]][i], valBar));
      
      const uf = rowData[4] - (valKpa * rowData[2]);
      const ug = rowData[5] - (valKpa * rowData[3]);

      setAnalysis({ 
        estado: "MISTURA SATURADA", color: "var(--accent)", 
        memorial: [`[ENTRADA] Pressão P = ${valKpa} kPa`, `[CONVERSÃO] P = ${fmt(valBar)} bar`, ...steps, `\n[ENERGIA INTERNA] Calculada via u = h - Pv`], 
        T: rowData[1], s_val: [rowData[6], rowData[7]], 
        u_str: `uf: ${fmt(uf)} | ug: ${fmt(ug)}`, h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}`
      });
      
      setResult({ 
        title: `Resultados para P = ${valKpa} kPa`, interped: satP[pts[0]][0] !== valBar, rawVal: rowData[1],
        keys: ['P', 'Tsat', 'vf', 'vg', 'uf', 'ug', 'hf', 'hg', 'sf', 'sg'], 
        units: ['kPa', '°C', 'm³/kg', 'm³/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg·K', 'kJ/kg·K'], 
        values: [valKpa, rowData[1], rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] 
      });
      setTableConfig({ type: 'sat-p', highlightVal: valKpa, calculatedRow: [valKpa, rowData[1], rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] });
    
    } else if (hasP && hasT) {
      const valBar = valKpa / 100;
      const ptsP = findThreePoints(satP, valBar, 0);
      const Tsat = interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][1], satP[ptsP[1]][0], satP[ptsP[1]][1], satP[ptsP[2]][0], satP[ptsP[2]][1], valBar);
      let memorial = [`[ENTRADAS] P = ${valKpa} kPa (${fmt(valBar)} bar) | T = ${valT} °C`, `Fronteira de Fase (Tsat):`];
      memorial.push(...generateCalcSteps(satP[ptsP[0]][0], satP[ptsP[0]][1], satP[ptsP[1]][0], satP[ptsP[1]][1], satP[ptsP[2]][0], satP[ptsP[2]][1], valBar, "Tsat"));

      if (valT > Tsat + 0.1) {
        memorial.push(`\n[FASE] T_sistema > Tsat ➔ (${valT} °C > ${fmt(Tsat)} °C) ➔ VAPOR SUPERAQUECIDO`);
        const { key, table } = findClosestTable(supData, valBar);
        memorial.push(`Buscando em tabela de Vapor (P_ref = ${key} bar).`);
        const ptsT = findThreePoints(table.rows, valT, 0);
        memorial.push(`\n[CÁLCULO ENTROPIA s]`);
        memorial.push(...generateCalcSteps(table.rows[ptsT[0]][0], table.rows[ptsT[0]][3], table.rows[ptsT[1]][0], table.rows[ptsT[1]][3], table.rows[ptsT[2]][0], table.rows[ptsT[2]][3], valT, "s"));

        const rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], valT));
        const u = rowData[2] - (valKpa * rowData[1]); 
        
        setAnalysis({ estado: "VAPOR SUPERAQUECIDO", color: "var(--amber)", memorial, T: valT, s_val: rowData[3], u_str: fmt(u), h_str: fmt(rowData[2]), s_str: fmt(rowData[3]) });
        setResult({ 
          title: `Vapor Superaquecido (P = ${valKpa} kPa, T = ${valT} °C)`, interped: table.rows[ptsT[0]][0] !== valT, rawVal: valT,
          keys: ['T', 'P', 'v', 'u', 'h', 's'], units: ['°C', 'kPa', 'm³/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg·K'], values: [valT, valKpa, rowData[1], u, rowData[2], rowData[3]]
        });
        setTableConfig({ type: 'sup', key, highlightVal: valT, calculatedRow: [valT, rowData[1], u, rowData[2], rowData[3]] });
      
      } else if (valT < Tsat - 0.1) {
        memorial.push(`\n[FASE] T_sistema < Tsat ➔ (${valT} °C < ${fmt(Tsat)} °C) ➔ LÍQUIDO COMPRIMIDO`);
        const valMPa = valKpa / 1000;
        const { key, table } = findClosestTable(liqData, valMPa); 
        memorial.push(`Buscando em tabela de Líquido (P_ref = ${key} MPa).`);
        const ptsT = findThreePoints(table.rows, valT, 0);
        memorial.push(`\n[CÁLCULO ENTROPIA s]`);
        memorial.push(...generateCalcSteps(table.rows[ptsT[0]][0], table.rows[ptsT[0]][3], table.rows[ptsT[1]][0], table.rows[ptsT[1]][3], table.rows[ptsT[2]][0], table.rows[ptsT[2]][3], valT, "s"));

        const rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], valT));
        const u = rowData[2] - ((parseFloat(key) * 1000) * rowData[1]); 
        
        setAnalysis({ estado: "LÍQUIDO COMPRIMIDO", color: "var(--accent)", memorial, T: valT, s_val: rowData[3], u_str: fmt(u), h_str: fmt(rowData[2]), s_str: fmt(rowData[3]) });
        setResult({ 
          title: `Líquido Comprimido (P = ${valKpa} kPa, T = ${valT} °C)`, interped: table.rows[ptsT[0]][0] !== valT, rawVal: valT,
          keys: ['T', 'P', 'v', 'u', 'h', 's'], units: ['°C', 'kPa', 'm³/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg·K'], values: [valT, valKpa, rowData[1], u, rowData[2], rowData[3]]
        });
        setTableConfig({ type: 'liq', key, highlightVal: valT, calculatedRow: [valT, rowData[1], u, rowData[2], rowData[3]] });
      
      } else {
        memorial.push(`\n[FASE] T_sistema ≅ Tsat ➔ (${valT} °C ≅ ${fmt(Tsat)} °C) ➔ MISTURA SATURADA`);
        const rowData = [0,1,2,3,4,5,6,7].map(i => interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][i], satP[ptsP[1]][0], satP[ptsP[1]][i], satP[ptsP[2]][0], satP[ptsP[2]][i], valBar));
        const uf = rowData[4] - (valKpa * rowData[2]);
        const ug = rowData[5] - (valKpa * rowData[3]);

        setAnalysis({ estado: "MISTURA SATURADA", color: "var(--accent)", memorial, T: rowData[1], s_val: [rowData[6], rowData[7]], u_str: `uf: ${fmt(uf)} | ug: ${fmt(ug)}`, h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}` });
        setResult({ 
          title: `Mistura Saturada (P = ${valKpa} kPa)`, interped: satP[ptsP[0]][0] !== valBar, rawVal: rowData[1],
          keys: ['P', 'Tsat', 'vf', 'vg', 'uf', 'ug', 'hf', 'hg', 'sf', 'sg'], 
          units: ['kPa', '°C', 'm³/kg', 'm³/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg', 'kJ/kg·K', 'kJ/kg·K'], 
          values: [valKpa, rowData[1], rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] 
        });
        setTableConfig({ type: 'sat-p', highlightVal: valKpa, calculatedRow: [valKpa, rowData[1], rowData[2], rowData[3], uf, ug, rowData[4], rowData[5], rowData[6], rowData[7]] });
      }
    }
  }, [inputP, inputT]);

  const renderTable = useMemo(() => {
    if (!tableConfig) return null;
    let h = []; let r = []; let kIdx = 0;

    if (tableConfig.type === 'sat-t') {
      h = ['T (°C)','P (kPa)','vf (m³/kg)','vg (m³/kg)','uf (kJ/kg)','ug (kJ/kg)','hf (kJ/kg)','hg (kJ/kg)','sf (kJ/kg·K)','sg (kJ/kg·K)'];
      r = satT.map(row => { 
        let pKpa = row[1] * 100;
        let uf = row[4] - (pKpa * row[2]);
        let ug = row[5] - (pKpa * row[3]);
        return [row[0], pKpa, row[2], row[3], uf, ug, row[4], row[5], row[6], row[7]]; 
      });
      kIdx = 0;
    } else if (tableConfig.type === 'sat-p') {
      h = ['P (kPa)','Tsat (°C)','vf (m³/kg)','vg (m³/kg)','uf (kJ/kg)','ug (kJ/kg)','hf (kJ/kg)','hg (kJ/kg)','sf (kJ/kg·K)','sg (kJ/kg·K)'];
      r = satP.map(row => { 
        let pKpa = row[0] * 100;
        let uf = row[4] - (pKpa * row[2]);
        let ug = row[5] - (pKpa * row[3]);
        return [pKpa, row[1], row[2], row[3], uf, ug, row[4], row[5], row[6], row[7]]; 
      });
      kIdx = 0;
    } else if (tableConfig.type === 'sup') {
      const pKpa = parseFloat(tableConfig.key) * 100; 
      h = ['T (°C)','v (m³/kg)','u (kJ/kg)','h (kJ/kg)','s (kJ/kg·K)'];
      r = supData[tableConfig.key].rows.map(row => [row[0], row[1], row[2] - (pKpa * row[1]), row[2], row[3]]);
      kIdx = 0;
    } else if (tableConfig.type === 'liq') {
      const pKpa = parseFloat(tableConfig.key) * 1000; 
      h = ['T (°C)','v (m³/kg)','u (kJ/kg)','h (kJ/kg)','s (kJ/kg·K)'];
      r = liqData[tableConfig.key].rows.map(row => [row[0], row[1], row[2] - (pKpa * row[1]), row[2], row[3]]);
      kIdx = 0;
    }

    if (tableConfig.calculatedRow) {
      const calcRow = [...tableConfig.calculatedRow];
      const calcKey = calcRow[kIdx];
      let exactMatchIndex = r.findIndex(row => Math.abs(row[kIdx] - calcKey) < 0.0001);
      
      if (exactMatchIndex === -1) {
          let inserted = false;
          for (let i = 0; i < r.length; i++) {
              if (calcKey < r[i][kIdx]) {
                  r.splice(i, 0, calcRow);
                  inserted = true;
                  break;
              }
          }
          if (!inserted) r.push(calcRow); 
      }
    }
    return { headers: h, rows: r, keyIdx: kIdx, highlightVal: tableConfig.highlightVal };
  }, [tableConfig]);

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
            <label className={styles.searchLabel}>PRESSÃO (kPa)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputP} onChange={e => setInputP(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Ex: 101.325" />
            </div>
          </div>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>TEMPERATURA (°C)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputT} onChange={e => setInputT(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Ex: 500" />
              <button onClick={handleSearch} style={{marginLeft: '10px'}}>Buscar</button>
            </div>
          </div>
        </div>

        {result && result.error && (
          <div className={`${styles.resultCard} ${styles.resultError}`}><p className={styles.errorMsg}>{result.error}</p></div>
        )}

        {analysis && (
          <div className={styles.memorialContainer} style={{ borderLeftColor: analysis.color }}>
            <h3 style={{ color: analysis.color, margin: '0 0 10px 0', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>STATUS: {analysis.estado}</h3>
            <div className={styles.statusHighlight}>
              <div className={styles.statusItem}><strong>Energia Interna (u)</strong><span>{analysis.u_str} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
              <div className={styles.statusItem}><strong>Entalpia (h)</strong><span>{analysis.h_str} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
              <div className={styles.statusItem}><strong>Entropia (s)</strong><span>{analysis.s_str} <small style={{color:'var(--text3)'}}>kJ/kg·K</small></span></div>
            </div>
            <div className={styles.memorialText}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '8px'}}>MEMORIAL DE CÁLCULO E FÓRMULAS:</strong>
              {analysis.memorial.map((line, i) => (<div key={i} className={styles.memorialLine}>{line}</div>))}
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultTitle}>{result.title}</span>
              {result.interped && <span className={styles.interpBadge}>Tabela Injetada (Interp. / Extrapolação)</span>}
            </div>
            <div className={styles.resultGrid}>
              {result.keys.map((k, i) => (
                <div key={k} className={styles.resultItem}>
                  <div className={styles.resultLabel}>{k}</div><div className={styles.resultVal}>{fmt(result.values[i])}</div><div className={styles.resultUnit}>{result.units[i]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && (
          <div className={styles.resultCard} style={{ padding: '1rem', overflow: 'hidden' }}>
            <RankineChart analysis={analysis} currentResult={result} />
          </div>
        )}

        {renderTable && renderTable.headers && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>{renderTable.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {renderTable.rows.map((row, ri) => (
                  <tr key={ri} className={renderTable.highlightVal !== null && Math.abs(row[renderTable.keyIdx] - renderTable.highlightVal) < 0.0001 ? styles.highlighted : ''}>
                    {row.map((v, ci) => <td key={ci}>{fmt(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <footer style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text3)', fontSize: '13px', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', marginTop: 'auto', letterSpacing: '0.05em' }}>
        Desenvolvido por: <strong style={{color: 'var(--text)'}}>Murilo Roberto Matias da Silva</strong> | Matrícula: 30313473
      </footer>
    </div>
  )
}