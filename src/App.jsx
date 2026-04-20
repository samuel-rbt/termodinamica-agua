import { useState, useCallback, useEffect, useRef } from 'react';
import RankineChart from './RankineChart';
import { satT, satP, supData } from './data';
import styles from './App.module.css';

const TermoEngine = {
  interp: (x0, y0, x1, y1, x) => {
    if (x0 === x1) return y0;
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  },

  getSatP: (p_kpa) => {
    const p_bar = p_kpa / 100;
    let idx = satP.findIndex(row => row[0] >= p_bar);
    if (idx === -1) idx = satP.length - 1;
    if (idx === 0) idx = 1;
    
    const r0 = satP[idx - 1]; const r1 = satP[idx];
    return {
      P: p_kpa,
      T: TermoEngine.interp(r0[0], r0[1], r1[0], r1[1], p_bar),
      vf: TermoEngine.interp(r0[0], r0[2], r1[0], r1[2], p_bar),
      vg: TermoEngine.interp(r0[0], r0[3], r1[0], r1[3], p_bar),
      hf: TermoEngine.interp(r0[0], r0[4], r1[0], r1[4], p_bar),
      hg: TermoEngine.interp(r0[0], r0[5], r1[0], r1[5], p_bar),
      sf: TermoEngine.interp(r0[0], r0[6], r1[0], r1[6], p_bar),
      sg: TermoEngine.interp(r0[0], r0[7], r1[0], r1[7], p_bar)
    };
  },

  getSatT: (t_c) => {
    let idx = satT.findIndex(row => row[0] >= t_c);
    if (idx === -1) idx = satT.length - 1;
    if (idx === 0) idx = 1;
    
    const r0 = satT[idx - 1]; const r1 = satT[idx];
    return {
      T: t_c,
      P: TermoEngine.interp(r0[0], r0[1], r1[0], r1[1], t_c) * 100 
    };
  },

  getSupPT: (p_kpa, t_c) => {
    const p_bar = p_kpa / 100;
    const keys = Object.keys(supData);
    const pKey = keys.reduce((prev, curr) => Math.abs(parseFloat(curr) - p_bar) < Math.abs(parseFloat(prev) - p_bar) ? curr : prev);
    const table = supData[pKey].rows;
    
    let idx = table.findIndex(r => r[0] >= t_c);
    if (idx === -1) idx = table.length - 1;
    if (idx === 0) idx = 1;

    const r0 = table[idx-1]; const r1 = table[idx];
    return {
      v: TermoEngine.interp(r0[0], r0[1], r1[0], r1[1], t_c),
      h: TermoEngine.interp(r0[0], r0[2], r1[0], r1[2], t_c),
      s: TermoEngine.interp(r0[0], r0[3], r1[0], r1[3], t_c)
    };
  },

  getSupPS: (p_kpa, s_target) => {
    const p_bar = p_kpa / 100;
    const keys = Object.keys(supData);
    const pKey = keys.reduce((prev, curr) => Math.abs(parseFloat(curr) - p_bar) < Math.abs(parseFloat(prev) - p_bar) ? curr : prev);
    const table = supData[pKey].rows;

    let idx = table.findIndex(r => r[3] >= s_target);
    if (idx === -1) idx = table.length - 1;
    if (idx === 0) idx = 1;

    const r0 = table[idx - 1]; const r1 = table[idx];
    return {
      T: TermoEngine.interp(r0[3], r0[0], r1[3], r1[0], s_target),
      h: TermoEngine.interp(r0[3], r0[2], r1[3], r1[2], s_target)
    };
  }
};

export default function App() {
  const [inputP, setInputP] = useState('4000');
  const [inputT, setInputT] = useState('400');
  const [pBaixa, setPBaixa] = useState(10);
  
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Controlador de Throttling (Acelerador) para a tabela não explodir
  const lastDragTime = useRef(0);

  const calcularTermodinamica = useCallback((p_kpa, t_c, p_cond_kpa) => {
    try {
      const satAlta = TermoEngine.getSatP(p_kpa);
      const satBaixa = TermoEngine.getSatP(p_cond_kpa);

      let estado = ""; let corEstado = ""; 
      let h1, s1, v1;

      if (t_c > satAlta.T + 0.1) {
        estado = "VAPOR SUPERAQUECIDO"; corEstado = "#ef4444"; 
        const props = TermoEngine.getSupPT(p_kpa, t_c);
        h1 = props.h; s1 = props.s; v1 = props.v;
      } else if (t_c < satAlta.T - 0.1) {
        estado = "LÍQUIDO COMPRIMIDO"; corEstado = "#10b981"; 
        h1 = satAlta.hf; s1 = satAlta.sf; v1 = satAlta.vf;
      } else {
        estado = "MISTURA SATURADA"; corEstado = "#f59e0b"; 
        h1 = satAlta.hg; s1 = satAlta.sg; v1 = satAlta.vg;
      }
      
      const u1 = h1 - (p_kpa * v1);
      const p1 = { id: 1, T: t_c, h: h1, s: s1, u: u1 };

      let h2, t2, titulo_x2 = null;
      if (s1 > satBaixa.sg) {
         const propsSuper = TermoEngine.getSupPS(p_cond_kpa, s1);
         h2 = propsSuper.h; t2 = propsSuper.T;
      } else if (s1 < satBaixa.sf) {
         h2 = satBaixa.hf; t2 = satBaixa.T;
      } else {
         titulo_x2 = (s1 - satBaixa.sf) / (satBaixa.sg - satBaixa.sf);
         h2 = satBaixa.hf + titulo_x2 * (satBaixa.hg - satBaixa.hf);
         t2 = satBaixa.T;
      }
      const p2 = { id: 2, T: t2, h: h2, s: s1 };

      const p3 = { id: 3, T: satBaixa.T, h: satBaixa.hf, s: satBaixa.sf, v: satBaixa.vf };
      const w_bomba = p3.v * (p_kpa - p_cond_kpa); 
      const h4 = p3.h + w_bomba;
      const deltaT_bomba = w_bomba / 4.184; 
      const p4 = { id: 4, T: p3.T + deltaT_bomba, h: h4, s: p3.s };

      const Wt = p1.h - p2.h;
      const ql = p2.h - p3.h;
      const Wb = p4.h - p3.h;
      const qh = p1.h - p4.h;
      const eta = qh > 0 ? (Wt - Wb) / qh : 0;

      let baseT = satT.filter(row => row[0] % 10 === 0 || row[0] === 0.01).map(r => r[0]);
      if (!baseT.includes(t_c) && t_c >= 0.01 && t_c <= 374.14) baseT.push(t_c);
      baseT.sort((a, b) => a - b);

      const tabela = baseT.map(t_val => {
          let idx = satT.findIndex(r => r[0] >= t_val);
          if (idx === -1) idx = satT.length - 1;
          if (idx === 0) idx = 1;
          
          const r0 = satT[idx-1]; const r1 = satT[idx];
          const pBar = TermoEngine.interp(r0[0], r0[1], r1[0], r1[1], t_val);
          const vl = TermoEngine.interp(r0[0], r0[2], r1[0], r1[2], t_val);
          const vv = TermoEngine.interp(r0[0], r0[3], r1[0], r1[3], t_val);
          const hl = TermoEngine.interp(r0[0], r0[4], r1[0], r1[4], t_val);
          const hv = TermoEngine.interp(r0[0], r0[5], r1[0], r1[5], t_val);
          const sl = TermoEngine.interp(r0[0], r0[6], r1[0], r1[6], t_val);
          const sv = TermoEngine.interp(r0[0], r0[7], r1[0], r1[7], t_val);
          const pkpa = pBar * 100;

          return {
              is_user: Math.abs(t_val - t_c) < 0.01,
              valores: [t_val, pkpa, vl, vv, hl - (pkpa * vl), (hv - hl) - (pkpa * (vv - vl)), hv - (pkpa * vv), hl, (hv - hl), hv, sl, (sv - sl), sv]
          };
      });

      setData({
          pontos: [p1, p2, p3, p4],
          satAlta: satAlta,
          satBaixa: satBaixa,
          estado, corEstado, Tsat: satAlta.T, tabela,
          formulas: { Wt, ql, Wb, qh, eta, x2: titulo_x2 }
      });
      setError(null);
    } catch (err) {
      setError("Os parâmetros excedem a base termodinâmica segura.");
    }
  }, []);

  useEffect(() => {
    calcularTermodinamica(parseFloat(inputP), parseFloat(inputT), pBaixa);
  }, [inputP, inputT, pBaixa, calcularTermodinamica]);

  // Esta função é chamada ENQUANTO você arrasta, mas com um freio de segurança (50ms)
  const handleGraphDrag = useCallback((novaTAlta, novaTBaixa) => {
      const now = Date.now();
      if (now - lastDragTime.current > 50) { // Limita a ~20 atualizações por segundo
          if (novaTAlta) setInputT(novaTAlta.toFixed(1));
          if (novaTBaixa) {
              const novaP = TermoEngine.getSatT(novaTBaixa).P;
              setPBaixa(novaP); 
          }
          lastDragTime.current = now;
      }
  }, []);

  // Esta garante que o último milissegundo do arrasto crave o número exato
  const handleGraphDrop = useCallback((novaTAlta, novaTBaixa) => {
      if (novaTAlta) setInputT(novaTAlta.toFixed(1));
      if (novaTBaixa) {
          const novaP = TermoEngine.getSatT(novaTBaixa).P;
          setPBaixa(novaP);
      }
  }, []);

  return (
    <div className={styles.app} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
             <span className={styles.logoIcon}>H₂O</span>
             <div>
                <div className={styles.logoTitle}>Tabelas Termodinâmicas</div>
                <div className={styles.logoSub}>Propriedas da Água e Vapor</div>
             </div>
          </div>
        </div>
        <div style={{ background: 'var(--accent)', color: 'white', padding: '5px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
            🖱️ DICA: Arraste os pontos no gráfico para ajustar as temperaturas livremente!
        </div>
      </header>

      <main className={styles.main} style={{ flex: 1 }}>
        <div className={styles.searchBar}>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>PRESSÃO (kPa)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputP} onChange={e => setInputP(e.target.value)} />
            </div>
          </div>
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>TEMPERATURA (°C)</label>
            <div className={styles.searchInput}>
              <input type="number" step="0.1" value={inputT} onChange={e => setInputT(e.target.value)} />
            </div>
          </div>
        </div>
        
        {error && <div className={`${styles.resultCard} ${styles.resultError}`}><p className={styles.errorMsg}>{error}</p></div>}
        
        {data && (
          <>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className={styles.resultCard} style={{ flex: 1, padding: '20px', borderLeft: `6px solid ${data.corEstado}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '300px' }}>
                    <h3 style={{ color: data.corEstado, margin: '0 0 10px 0', fontSize: '15px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>ESTADO: {data.estado}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                        <div><strong>Energia Interna (u₁):</strong> {data.pontos[0].u.toFixed(2)} kJ/kg</div>
                        <div><strong>Entalpia (h₁):</strong> {data.pontos[0].h.toFixed(2)} kJ/kg</div>
                        <div><strong>Entropia (s₁):</strong> {data.pontos[0].s.toFixed(4)} kJ/kg·K</div>
                    </div>
                </div>
                <div className={styles.resultCard} style={{ flex: 1, padding: '20px', background: 'var(--bg2)', border: '1px solid var(--border)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '300px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>RENDIMENTO TÉRMICO DO SISTEMA (η)</div>
                    <div style={{ fontSize: '32px', color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'var(--font-sans)' }}>{(data.formulas.eta * 100).toFixed(2)} %</div>
                </div>
            </div>

            <div className={styles.resultCard} style={{ padding: '1rem', overflow: 'hidden', marginBottom: '20px' }}>
              <RankineChart 
                pontos={data.pontos} 
                satAlta={data.satAlta} 
                satBaixa={data.satBaixa}
                cycleColor={data.corEstado} 
                onGraphDrag={handleGraphDrag}
                onGraphDrop={handleGraphDrop} 
              />
            </div>

            <div className={styles.memorialContainer} style={{ borderLeftColor: data.corEstado }}>
              <div className={styles.memorialText} style={{ padding: '15px', borderRadius: '8px' }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '15px', fontFamily: 'var(--font-mono)'}}>MEMORIAL DE CÁLCULO E ANÁLISE DO CICLO:</strong>
                
                <div className={styles.memorialLine} style={{ color: data.corEstado, fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '10px' }}>[PARÂMETROS DE ENTRADA]</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Pressão (P₁) = {inputP} kPa</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Temperatura (T₁) = {inputT} °C</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Pressão de Saída (P₂) = {pBaixa.toFixed(2)} kPa</div>
                
                <div className={styles.memorialLine} style={{ color: data.corEstado, fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '15px' }}>[ESTADO TERMODINÂMICO]</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Tsat(P₁) = {data.Tsat.toFixed(2)} °C</div>
                {data.formulas.x2 !== null && (
                    <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Título do Vapor (x₂) = {data.formulas.x2.toFixed(4)}</div>
                )}
                
                <div className={styles.memorialLine} style={{ color: data.corEstado, fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '15px' }}>[ENTALPIAS ENCONTRADAS]</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>h₁ = {data.pontos[0].h.toFixed(2)} kJ/kg (P₁, T₁)</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>h₂ = {data.pontos[1].h.toFixed(2)} kJ/kg (P₂, s₂=s₁)</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>h₃ = {data.pontos[2].h.toFixed(2)} kJ/kg (P₂, Líq. Saturado)</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>h₄ = {data.pontos[3].h.toFixed(2)} kJ/kg (P₁, s₄=s₃)</div>

                <div className={styles.memorialLine} style={{ color: data.corEstado, fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '15px' }}>[FÓRMULAS E BALANÇO DE ENERGIA]</div>
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>➤ Trabalho da Turbina (Wt):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Wt = h₁ - h₂ = {data.pontos[0].h.toFixed(2)} - {data.pontos[1].h.toFixed(2)} = <strong>{data.formulas.Wt.toFixed(2)} kJ/kg</strong></div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Calor Rejeitado (ql):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>ql = h₂ - h₃ = {data.pontos[1].h.toFixed(2)} - {data.pontos[2].h.toFixed(2)} = <strong>{data.formulas.ql.toFixed(2)} kJ/kg</strong></div>

                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Trabalho da Bomba (Wb):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>Wb = h₄ - h₃ = {data.pontos[3].h.toFixed(2)} - {data.pontos[2].h.toFixed(2)} = <strong>{data.formulas.Wb.toFixed(2)} kJ/kg</strong></div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Calor Fornecido (qh):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>qh = h₁ - h₄ = {data.pontos[0].h.toFixed(2)} - {data.pontos[3].h.toFixed(2)} = <strong>{data.formulas.qh.toFixed(2)} kJ/kg</strong></div>
                
                <div className={styles.memorialLine} style={{ color: 'var(--text)', fontWeight: 'bold', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>➤ Rendimento Térmico (η):</div>
                <div className={styles.memorialLine} style={{ marginLeft: '15px', fontFamily: 'var(--font-mono)'}}>η = (Wt - Wb) / qh = ({data.formulas.Wt.toFixed(2)} - {data.formulas.Wb.toFixed(2)}) / {data.formulas.qh.toFixed(2)} = <strong>{(data.formulas.eta*100).toFixed(2)}%</strong></div>
              </div>
            </div>

            <div className={styles.resultCard} style={{ marginTop: '20px', overflow: 'hidden' }}>
              <div className={styles.resultHeader}>
                <span className={styles.resultTitle}>Água saturada: tabela em função da temperatura (B.1.1)</span>
              </div>
              <div className={styles.tableWrap} style={{ overflowX: 'auto', borderTop: 'none', marginTop: '0' }}>
                <table className={styles.table}>
                  <thead style={{ background: 'var(--bg3)' }}>
                    <tr>
                      <th rowSpan="2" style={{verticalAlign: 'middle', background: 'var(--bg3)', color: 'var(--text)', borderRight: '1px solid var(--border)'}}>T (ºC)</th>
                      <th rowSpan="2" style={{verticalAlign: 'middle', background: 'var(--bg3)', color: 'var(--text)', borderRight: '1px solid var(--border)'}}>P (kPa)</th>
                      <th colSpan="2" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Volume Específico</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Energia Interna</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)', borderRight: '1px solid var(--border)'}}>Entalpia</th>
                      <th colSpan="3" style={{textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', borderBottom: '1px solid var(--border2)'}}>Entropia</th>
                    </tr>
                    <tr>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>vl</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>vv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>ul</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>ulv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>uv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>hl</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>hlv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)', borderRight: '1px solid var(--border)'}}>hv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>sl</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>slv</th>
                      <th style={{background: 'var(--bg3)', color: 'var(--text3)'}}>sv</th>
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