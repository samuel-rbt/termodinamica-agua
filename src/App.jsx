import { useState, useCallback } from 'react'
import RankineChart from './RankineChart'
import { satT, satTHeaders, satTKeys, satTUnits, satP, satPHeaders, satPKeys, satPUnits, supData, liqData } from './data'
import styles from './App.module.css'

function fmt(v) {
  if (typeof v !== 'number') return v;
  if (Math.abs(v) < 0.0001) return v.toExponential(4);
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

// GERADOR DO MEMORIAL MATEMÁTICO (Lagrange)
function generateCalcSteps(x0, y0, x1, y1, x2, y2, x, yName="y") {
  if (x0 === x1 || x1 === x2 || x0 === x2) return ["Erro: Pontos inválidos (Divisão por zero)."];
  const L0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const L1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const L2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  const y = y0 * L0 + y1 * L1 + y2 * L2;

  return [
    `[INTERPOLAÇÃO DE LAGRANGE PARA ENCONTRAR ${yName}]`,
    `➤ Pontos da Tabela Base (x, y):\n   P₀ = (${fmt(x0)}, ${fmt(y0)})\n   P₁ = (${fmt(x1)}, ${fmt(y1)})\n   P₂ = (${fmt(x2)}, ${fmt(y2)})`,
    `➤ Coeficientes de Ponderação (L):\n   L₀ = (${fmt(x)} - ${fmt(x1)})(${fmt(x)} - ${fmt(x2)}) / (${fmt(x0)} - ${fmt(x1)})(${fmt(x0)} - ${fmt(x2)}) = ${fmt(L0)}\n   L₁ = (${fmt(x)} - ${fmt(x0)})(${fmt(x)} - ${fmt(x2)}) / (${fmt(x1)} - ${fmt(x0)})(${fmt(x1)} - ${fmt(x2)}) = ${fmt(L1)}\n   L₂ = (${fmt(x)} - ${fmt(x0)})(${fmt(x)} - ${fmt(x1)}) / (${fmt(x2)} - ${fmt(x0)})(${fmt(x2)} - ${fmt(x1)}) = ${fmt(L2)}`,
    `➤ Resolução Final:\n   ${yName} = (y₀ × L₀) + (y₁ × L₁) + (y₂ × L₂)\n   ${yName} = (${fmt(y0)} × ${fmt(L0)}) + (${fmt(y1)} × ${fmt(L1)}) + (${fmt(y2)} × ${fmt(L2)})`,
    `➤ Resultado Calculado:\n   ${yName} = ${fmt(y)}`
  ];
}

function findThreePoints(arr, val, idx) {
  let lo = -1;
  for (let i = 0; i < arr.length - 1; i++) { if (arr[i][idx] <= val && arr[i + 1][idx] >= val) { lo = i; break; } }
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
  const [inputP, setInputP] = useState('');
  const [inputT, setInputT] = useState('');
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [highlightVal, setHighlightVal] = useState(null);

  const handleSearch = useCallback(() => {
    setResult(null); setAnalysis(null); setHighlightVal(null); setTableInfo(null);
    const valP = parseFloat(inputP); // O USUÁRIO DIGITA EM BAR
    const valT = parseFloat(inputT); // O USUÁRIO DIGITA EM °C
    const hasP = !isNaN(valP);
    const hasT = !isNaN(valT);

    if (!hasP && !hasT) { alert("Insira Pressão e/ou Temperatura."); return; }

    let estado = ""; let memorial = []; let rowData = []; 
    let keys = []; let units = []; let currentT = 0; let s_val = null;

    if (hasT && !hasP) {
      // APENAS TEMPERATURA
      const pts = findThreePoints(satT, valT, 0);
      if (pts[0] === -1) { setResult({ error: "Temperatura fora da tabela (0.01 a 374.14 °C)." }); return; }
      
      const steps = generateCalcSteps(satT[pts[0]][0], satT[pts[0]][1], satT[pts[1]][0], satT[pts[1]][1], satT[pts[2]][0], satT[pts[2]][1], valT, "Psat (bar)");
      rowData = satTKeys.map((_, i) => interpQuad(satT[pts[0]][0], satT[pts[0]][i], satT[pts[1]][0], satT[pts[1]][i], satT[pts[2]][0], satT[pts[2]][i], valT));
      
      // Converte o resultado de bar para Pa
      rowData[1] = rowData[1] * 100000;
      let tUnits = [...satTUnits]; tUnits[1] = 'Pa';
      
      const modRows = satT.map(r => { let nr = [...r]; nr[1] *= 100000; return nr; });
      let modHeaders = [...satTHeaders]; modHeaders[1] = 'P (Pa)';

      keys = satTKeys; units = tUnits; currentT = valT; s_val = [rowData[6], rowData[7]];
      setTableInfo({ headers: modHeaders, rows: modRows, keyIdx: 0 });
      setHighlightVal(valT);
      
      setAnalysis({ 
        estado: "MISTURA SATURADA (Foco em Temperatura)", color: "var(--accent)", T: currentT, s_val, 
        h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}`,
        memorial: [`[ENTRADA] Temperatura T = ${valT} °C`, ...steps, `\n[CONVERSÃO FINAL PARA O PROFESSOR] Psat (Pascal) = Psat(bar) × 100000 = ${fmt(rowData[1])} Pa`] 
      });
      setResult({ title: `Resultados para T = ${valT} °C`, interped: satT[pts[0]][0] !== valT, keys: satTKeys, units: tUnits, values: rowData, rawVal: valT });
    
    } else if (hasP && !hasT) {
      // APENAS PRESSÃO
      const pts = findThreePoints(satP, valP, 0);
      if (pts[0] === -1) { setResult({ error: "Pressão fora da tabela de saturação (0.00611 bar a 220.9 bar)." }); return; }
      
      const steps = generateCalcSteps(satP[pts[0]][0], satP[pts[0]][1], satP[pts[1]][0], satP[pts[1]][1], satP[pts[2]][0], satP[pts[2]][1], valP, "Tsat (°C)");
      rowData = satPKeys.map((_, i) => interpQuad(satP[pts[0]][0], satP[pts[0]][i], satP[pts[1]][0], satP[pts[1]][i], satP[pts[2]][0], satP[pts[2]][i], valP));
      
      // Converte a pressão de volta para Pa
      rowData[0] = rowData[0] * 100000; 
      let pUnits = [...satPUnits]; pUnits[0] = 'Pa';

      const modRows = satP.map(r => { let nr = [...r]; nr[0] *= 100000; return nr; });
      let modHeaders = [...satPHeaders]; modHeaders[0] = 'P (Pa)';

      keys = satPKeys; units = pUnits; currentT = rowData[1]; s_val = [rowData[6], rowData[7]];
      setTableInfo({ headers: modHeaders, rows: modRows, keyIdx: 0 });
      setHighlightVal(valP * 100000); 
      
      setAnalysis({ 
        estado: "MISTURA SATURADA (Foco em Pressão)", color: "var(--accent)", T: currentT, s_val, 
        h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}`,
        memorial: [`[ENTRADA] Pressão P = ${valP} bar`, ...steps, `\n[CONVERSÃO FINAL PARA O PROFESSOR] P_exibição = ${valP} × 100000 = ${fmt(rowData[0])} Pa`] 
      });
      setResult({ title: `Resultados para P = ${valP * 100000} Pa`, interped: satP[pts[0]][0] !== valP, keys: satPKeys, units: pUnits, values: rowData, rawVal: rowData[1] });
    
    } else if (hasP && hasT) {
      // PRESSÃO E TEMPERATURA
      const ptsP = findThreePoints(satP, valP, 0);
      if (ptsP[0] === -1) { setResult({ error: "Pressão fora dos limites termodinâmicos de saturação (0.00611 a 220.9 bar)." }); return; }
      
      const Tsat = interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][1], satP[ptsP[1]][0], satP[ptsP[1]][1], satP[ptsP[2]][0], satP[ptsP[2]][1], valP);
      const stepsTsat = generateCalcSteps(satP[ptsP[0]][0], satP[ptsP[0]][1], satP[ptsP[1]][0], satP[ptsP[1]][1], satP[ptsP[2]][0], satP[ptsP[2]][1], valP, "Tsat");
      
      memorial.push(`[ENTRADAS] P = ${valP} bar | T = ${valT} °C`);
      memorial.push(`Determinando a Fronteira de Fase (Tsat):`);
      memorial.push(...stepsTsat);

      if (valT > Tsat + 0.1) {
        estado = "VAPOR SUPERAQUECIDO";
        memorial.push(`\n[ANÁLISE DE FASE] T_sistema > Tsat ➔ (${valT} °C > ${fmt(Tsat)} °C)`);
        
        const { key, table } = findClosestTable(supData, valP);
        memorial.push(`Buscando em tabela de Vapor (P_ref = ${key} bar).`);
        const ptsT = findThreePoints(table.rows, valT, 0);
        if (ptsT[0] === -1) { setResult({ error: `T = ${valT}°C fora da tabela superaquecida para P=${key} bar.` }); return; }
        
        memorial.push(`\n[CÁLCULO DA ENTROPIA s]`);
        memorial.push(...generateCalcSteps(table.rows[ptsT[0]][0], table.rows[ptsT[0]][3], table.rows[ptsT[1]][0], table.rows[ptsT[1]][3], table.rows[ptsT[2]][0], table.rows[ptsT[2]][3], valT, "s"));

        rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], valT));
        keys = ['T','v','h','s']; units = ['°C','m³/kg','kJ/kg','kJ/kg·K'];
        
        setTableInfo({ headers: table.headers, rows: table.rows, keyIdx: 0 });
        setHighlightVal(valT);
        setAnalysis({ estado, color: "var(--amber)", memorial, T: valT, s_val: rowData[3], h_str: fmt(rowData[2]), s_str: fmt(rowData[3]) });
        setResult({ title: `Vapor Superaquecido (P = ${valP * 100000} Pa, T = ${valT} °C)`, interped: table.rows[ptsT[0]][0] !== valT, keys: ['T','v','h','s'], units: units, values: rowData, rawVal: valT });
      
      } else if (valT < Tsat - 0.1) {
        estado = "LÍQUIDO COMPRIMIDO";
        memorial.push(`\n[ANÁLISE DE FASE] T_sistema < Tsat ➔ (${valT} °C < ${fmt(Tsat)} °C)`);
        
        const { key, table } = findClosestTable(liqData, valP / 10);
        memorial.push(`Buscando em tabela de Líquido (P_ref = ${key} MPa).`);
        const ptsT = findThreePoints(table.rows, valT, 0);
        if (ptsT[0] === -1) { setResult({ error: `T = ${valT}°C fora da tabela de líquido para P=${key} MPa.` }); return; }
        
        memorial.push(`\n[CÁLCULO DA ENTROPIA s]`);
        memorial.push(...generateCalcSteps(table.rows[ptsT[0]][0], table.rows[ptsT[0]][3], table.rows[ptsT[1]][0], table.rows[ptsT[1]][3], table.rows[ptsT[2]][0], table.rows[ptsT[2]][3], valT, "s"));

        rowData = [0,1,2,3].map(i => interpQuad(table.rows[ptsT[0]][0], table.rows[ptsT[0]][i], table.rows[ptsT[1]][0], table.rows[ptsT[1]][i], table.rows[ptsT[2]][0], table.rows[ptsT[2]][i], valT));
        keys = ['T','v','h','s']; units = ['°C','m³/kg','kJ/kg','kJ/kg·K'];
        
        setTableInfo({ headers: table.headers, rows: table.rows, keyIdx: 0 });
        setHighlightVal(valT);
        setAnalysis({ estado, color: "var(--accent)", memorial, T: valT, s_val: rowData[3], h_str: fmt(rowData[2]), s_str: fmt(rowData[3]) });
        setResult({ title: `Líquido Comprimido (P = ${valP * 100000} Pa, T = ${valT} °C)`, interped: table.rows[ptsT[0]][0] !== valT, keys: ['T','v','h','s'], units: units, values: rowData, rawVal: valT });
      
      } else {
        estado = "MISTURA SATURADA";
        memorial.push(`\n[ANÁLISE DE FASE] T_sistema ≅ Tsat ➔ (${valT} °C ≅ ${fmt(Tsat)} °C)`);
        memorial.push(`Extraindo as linhas de saturação do fluido.`);
        rowData = satPKeys.map((_, i) => interpQuad(satP[ptsP[0]][0], satP[ptsP[0]][i], satP[ptsP[1]][0], satP[ptsP[1]][i], satP[ptsP[2]][0], satP[ptsP[2]][i], valP));
        
        rowData[0] = rowData[0] * 100000; // Converte para Pascal
        let pUnits = [...satPUnits]; pUnits[0] = 'Pa';
        const modRows = satP.map(r => { let nr = [...r]; nr[0] *= 100000; return nr; });
        let modHeaders = [...satPHeaders]; modHeaders[0] = 'P (Pa)';

        keys = satPKeys; units = pUnits;
        setTableInfo({ headers: modHeaders, rows: modRows, keyIdx: 0 });
        setHighlightVal(valP * 100000);
        setAnalysis({ estado, color: "var(--accent)", memorial, T: rowData[1], s_val: [rowData[6], rowData[7]], h_str: `hf: ${fmt(rowData[4])} | hg: ${fmt(rowData[5])}`, s_str: `sf: ${fmt(rowData[6])} | sg: ${fmt(rowData[7])}` });
        setResult({ title: `Mistura Saturada (P = ${valP * 100000} Pa)`, interped: satP[ptsP[0]][0] !== valP, keys: satPKeys, units: pUnits, values: rowData, rawVal: rowData[1] });
      }
    }
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
              {/* LIMITES DE PRESSÃO: 0.01 até 500 */}
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                max="500" 
                value={inputP} 
                onChange={e => setInputP(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                placeholder="Ex: 5.0" 
              />
            </div>
          </div>
          
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>TEMPERATURA (°C)</label>
            <div className={styles.searchInput}>
              {/* LIMITES DE TEMPERATURA: 0.01 até 300 */}
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                max="300" 
                value={inputT} 
                onChange={e => setInputT(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                placeholder="Ex: 300" 
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

        {/* STATUS COM ENTALPIA E ENTROPIA EM DESTAQUE */}
        {analysis && (
          <div className={styles.memorialContainer} style={{ borderLeftColor: analysis.color }}>
            <h3 style={{ color: analysis.color, margin: '0 0 10px 0', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
              STATUS: {analysis.estado}
            </h3>
            
            <div className={styles.statusHighlight}>
              <div className={styles.statusItem}>
                <strong>Entalpia (h)</strong>
                <span>{analysis.h_str} <small style={{color:'var(--text3)'}}>kJ/kg</small></span>
              </div>
              <div className={styles.statusItem}>
                <strong>Entropia (s)</strong>
                <span>{analysis.s_str} <small style={{color:'var(--text3)'}}>kJ/kg·K</small></span>
              </div>
            </div>

            <div className={styles.memorialText}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '8px'}}>MEMORIAL DE CÁLCULO E FÓRMULAS:</strong>
              {analysis.memorial.map((line, i) => (
                <div key={i} className={styles.memorialLine}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultTitle}>{result.title}</span>
              {result.interped && <span className={styles.interpBadge}>interpolação quadrática</span>}
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
          <div className={styles.resultCard} style={{ padding: '1rem', overflow: 'hidden' }}>
            <RankineChart analysis={analysis} currentResult={result} />
          </div>
        )}

        {tableInfo && tableInfo.headers && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>{tableInfo.headers.map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tableInfo.rows.map((row, ri) => (
                  <tr key={ri} className={highlightVal !== null && Math.abs(row[tableInfo.keyIdx] - highlightVal) < 0.0001 ? styles.highlighted : ''}>
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