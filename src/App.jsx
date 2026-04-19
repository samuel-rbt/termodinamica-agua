import { useState, useCallback, useMemo } from 'react';
import RankineChart from './RankineChart';
import { satT, satP, supData } from './data';
import styles from './App.module.css';

// Função auxiliar de interpolação linear (Substitui o Python)
function interp(x0, y0, x1, y1, x) {
  if (x0 === x1) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function getSatPropsByP(p_kpa) {
  const p_bar = p_kpa / 100;
  let idx = satP.findIndex(row => row[0] >= p_bar);
  if (idx === 0) idx = 1;
  if (idx === -1) idx = satP.length - 1;
  
  const r0 = satP[idx - 1]; const r1 = satP[idx];
  const t = interp(r0[0], r0[1], r1[0], r1[1], p_bar);
  const vf = interp(r0[0], r0[2], r1[0], r1[2], p_bar);
  const vg = interp(r0[0], r0[3], r1[0], r1[3], p_bar);
  const hf = interp(r0[0], r0[4], r1[0], r1[4], p_bar);
  const hg = interp(r0[0], r0[5], r1[0], r1[5], p_bar);
  const sf = interp(r0[0], r0[6], r1[0], r1[6], p_bar);
  const sg = interp(r0[0], r0[7], r1[0], r1[7], p_bar);
  return { T: t, vf, vg, hf, hg, sf, sg };
}

export default function App() {
  const [inputP, setInputP] = useState('');
  const [inputT, setInputT] = useState('');
  
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const buscar = useCallback(() => {
    if (!inputP || !inputT) {
      alert("Insira a Pressão e a Temperatura para calcular o ciclo.");
      return;
    }
    setError(null);

    try {
      const p_kpa = parseFloat(inputP);
      const t_c = parseFloat(inputT);
      const p_cond_kpa = 10; // Condensador fixo em 10 kPa

      // --- CÁLCULO DAS PROPRIEDADES VIA JAVASCRIPT (Usando data.js) ---
      const satCaldeira = getSatPropsByP(p_kpa);
      const satCondensador = getSatPropsByP(p_cond_kpa);

      let estado = "";
      let h1, s1;

      if (t_c > satCaldeira.T + 0.1) {
        estado = "VAPOR SUPERAQUECIDO";
        // Simplificação matemática usando o Superaquecido mais próximo (Para o JS não explodir)
        const p_bar = p_kpa / 100;
        const keys = Object.keys(supData);
        const closestKey = keys.reduce((prev, curr) => Math.abs(curr - p_bar) < Math.abs(prev - p_bar) ? curr : prev);
        const table = supData[closestKey].rows;
        let idx = table.findIndex(r => r[0] >= t_c);
        if (idx <= 0) idx = 1; if (idx === -1) idx = table.length - 1;
        
        const v1 = interp(table[idx-1][0], table[idx-1][1], table[idx][0], table[idx][1], t_c);
        h1 = interp(table[idx-1][0], table[idx-1][2], table[idx][0], table[idx][2], t_c);
        s1 = interp(table[idx-1][0], table[idx-1][3], table[idx][0], table[idx][3], t_c);
      } else if (t_c < satCaldeira.T - 0.1) {
        estado = "LÍQUIDO COMPRIMIDO";
        h1 = satCaldeira.hf; 
        s1 = satCaldeira.sf;
      } else {
        estado = "MISTURA SATURADA";
        h1 = satCaldeira.hg; // Assumindo vapor para o ciclo
        s1 = satCaldeira.sg;
      }

      // --- PONTOS DO CICLO RANKINE ---
      const p1 = { T: t_c, h: h1, s: s1 };
      const p3 = { T: satCondensador.T, h: satCondensador.hf, s: satCondensador.sf, v: satCondensador.vf };
      
      // Ponto 2 (Saída Turbina, s2 = s1)
      const x2 = (s1 - satCondensador.sf) / (satCondensador.sg - satCondensador.sf);
      const h2 = satCondensador.hf + x2 * (satCondensador.hg - satCondensador.hf);
      const p2 = { T: satCondensador.T, h: h2, s: s1 };

      // Ponto 4 (Saída Bomba, h4 = h3 + v3*dP)
      const w_bomba = p3.v * (p_kpa - p_cond_kpa);
      const h4 = p3.h + w_bomba;
      const p4 = { T: satCondensador.T + 1, h: h4, s: p3.s }; // +1 T apenas para visualização

      // --- BALANÇO DE ENERGIA ---
      const Wt = p1.h - p2.h;
      const Wb = p4.h - p3.h;
      const Qin = p1.h - p4.h;
      const eta = Qin > 0 ? (Wt - Wb) / Qin : 0;

      // --- CONSTRUIR TABELA DINÂMICA VAN WYLEN DO DATA.JS ---
      const tabela = satT.filter((row, i) => i % 2 === 0).map(row => {
          const t = row[0];
          const pk = row[1] * 100; // bar para kPa
          const vl = row[2];
          const vv = row[3];
          const hl = row[4];
          const hv = row[5];
          const sl = row[6];
          const sv = row[7];
          const hlv = hv - hl;
          const slv = sv - sl;
          // Energia Interna u = h - Pv
          const ul = hl - (pk * vl);
          const uv = hv - (pk * vv);
          const ulv = uv - ul;

          return {
              is_user: Math.abs(t - t_c) < 2,
              valores: [t, pk, vl, vv, ul, ulv, uv, hl, hlv, hv, sl, slv, sv]
          };
      });

      setData({
          pontos: [p1, p2, p3, p4],
          estado,
          Tsat: satCaldeira.T,
          tabela: tabela.slice(0, 15), // Limita as linhas para não travar
          formulas: { Wt, Wb, Qin, eta }
      });

    } catch (err) {
      setError("Valores fora da faixa da tabela local.");
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
            <label className={styles.searchLabel}>PRESSÃO (kPa)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputP} onChange={e => setInputP(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Ex: 2000" />
            </div>
          </div>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>TEMPERATURA (°C)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputT} onChange={e => setInputT(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Ex: 350" />
              <button onClick={buscar} style={{marginLeft: '10px'}}>Buscar</button>
            </div>
          </div>
        </div>

        {error && <div className={`${styles.resultCard} ${styles.resultError}`}><p className={styles.errorMsg}>{error}</p></div>}

        {data && (
          <>
            <div className={styles.memorialContainer} style={{ borderLeftColor: 'var(--accent)' }}>
              <h3 style={{ color: 'var(--accent)', margin: '0 0 10px 0', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
                STATUS: {data.estado}
              </h3>
              <div className={styles.statusHighlight}>
                <div className={styles.statusItem}><strong>Energia Interna (u)</strong><span>{(data.pontos[0].h - (parseFloat(inputP) * 0.001)).toFixed(2)} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
                <div className={styles.statusItem}><strong>Entalpia (h)</strong><span>{data.pontos[0].h.toFixed(2)} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
                <div className={styles.statusItem}><strong>Entropia (s)</strong><span>{data.pontos[0].s.toFixed(4)} <small style={{color:'var(--text3)'}}>kJ/kg·K</small></span></div>
              </div>
              
              <div className={styles.memorialText} style={{marginTop: '20px', background: 'var(--bg2)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)'}}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-mono)'}}>MEMORIAL DE CÁLCULO E ANÁLISE DO CICLO (Local JS):</strong>
                
                <div className={styles.memorialLine} style={{ color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '10px' }}>[PARÂMETROS DE ENTRADA]</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>P_caldeira = {inputP} kPa</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>T_caldeira = {inputT} °C</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>P_condensador = 10 kPa</div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '15px' }}>[FÓRMULAS E BALANÇO DE ENERGIA]</div>
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>➤ Trabalho da Turbina (Wt):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Wt = h₁ - h₂ = {data.pontos[0].h.toFixed(2)} - {data.pontos[1].h.toFixed(2)} = {data.formulas.Wt.toFixed(2)} kJ/kg</div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Trabalho da Bomba (Wb):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Wb = h₄ - h₃ = {data.pontos[3].h.toFixed(2)} - {data.pontos[2].h.toFixed(2)} = {data.formulas.Wb.toFixed(2)} kJ/kg</div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Calor Fornecido (qh):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>qh = h₁ - h₄ = {data.pontos[0].h.toFixed(2)} - {data.pontos[3].h.toFixed(2)} = {data.formulas.Qin.toFixed(2)} kJ/kg</div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Rendimento Térmico (η):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>η = (Wt - Wb) / qh = ({data.formulas.Wt.toFixed(2)} - {data.formulas.Wb.toFixed(2)}) / {data.formulas.Qin.toFixed(2)} = {(data.formulas.eta*100).toFixed(2)}%</div>
              </div>
            </div>

            <div className={styles.resultCard} style={{ padding: '1rem', overflow: 'hidden' }}>
              <RankineChart pontos={data.pontos} inputT={inputT} inputP={inputP} />
            </div>

            <div className={styles.resultCard} style={{ marginTop: '20px', overflow: 'hidden' }}>
              <div className={styles.resultHeader}>
                <span className={styles.resultTitle}>Água saturada: tabela em função da temperatura (Padrão Van Wylen B.1.1)</span>
              </div>
              <div className={styles.tableWrap} style={{ overflowX: 'auto', borderTop: 'none', marginTop: '0' }}>
                <table className={styles.table}>
                  <thead style={{ background: 'var(--bg3)' }}>
                    <tr>
                      <th rowSpan="2" style={{verticalAlign: 'middle', background: 'var(--bg3)', color: 'var(--text)', borderRight: '1px solid var(--border)'}}>T (ºC)</th>
                      <th rowSpan="2" style={{verticalAlign: 'middle', background: 'var(--bg3)', color: 'var(--text)', borderRight: '1px solid var(--border)'}}>Pressão<br/>kPa</th>
                      <th colSpan="2" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Volume Específico (m³/kg)</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Energia Interna (kJ/kg)</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Entalpia (kJ/kg)</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)'}}>Entropia (kJ/kg·K)</th>
                    </tr>
                    <tr>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Líquido Sat. (vl)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>Vapor Sat. (vv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Líquido Sat. (ul)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Evaporação (ulv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>Vapor Sat. (uv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Líquido Sat. (hl)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Evaporação (hlv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>Vapor Sat. (hv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Líquido Sat. (sl)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Evaporação (slv)</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>Vapor Sat. (sv)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tabela.map((row, i) => (
                      <tr key={i} className={row.is_user ? styles.highlighted : ''}>
                        <td style={{borderRight: '1px solid var(--border)'}}>{row.valores[0].toFixed(2)}</td>
                        <td style={{borderRight: '1px solid var(--border)'}}>{row.valores[1].toFixed(2)}</td>
                        <td>{row.valores[2].toFixed(6)}</td>
                        <td style={{borderRight: '1px solid var(--border)'}}>{row.valores[3].toFixed(6)}</td>
                        <td>{row.valores[4].toFixed(2)}</td>
                        <td>{row.valores[5].toFixed(2)}</td>
                        <td style={{borderRight: '1px solid var(--border)'}}>{row.valores[6].toFixed(2)}</td>
                        <td>{row.valores[7].toFixed(2)}</td>
                        <td>{row.valores[8].toFixed(2)}</td>
                        <td style={{borderRight: '1px solid var(--border)'}}>{row.valores[9].toFixed(2)}</td>
                        <td>{row.valores[10].toFixed(4)}</td>
                        <td>{row.valores[11].toFixed(4)}</td>
                        <td>{row.valores[12].toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text3)', fontSize: '13px', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', marginTop: 'auto', letterSpacing: '0.05em' }}>
        Desenvolvido por: <strong style={{color: 'var(--text)'}}>Murilo Roberto Matias da Silva</strong> | Matrícula: 30313473
      </footer>
    </div>
  );
}