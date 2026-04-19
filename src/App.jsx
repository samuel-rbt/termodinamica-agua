import { useState } from 'react';
import RankineChart from './RankineChart';
import styles from './App.module.css';

export default function App() {
  const [inputP, setInputP] = useState('');
  const [inputT, setInputT] = useState('');
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buscar = async () => {
    if (!inputP || !inputT) {
      alert("Insira a Pressão e a Temperatura para calcular o ciclo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://termodinamica-agua.onrender.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            P: parseFloat(inputP), 
            T: parseFloat(inputT)
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro no servidor.");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    }
    setLoading(false);
  };

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
          
          {/* APENAS 2 INPUTS AQUI */}
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
              <button onClick={buscar} disabled={loading} style={{marginLeft: '10px'}}>{loading ? '...' : 'Buscar'}</button>
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
                <div className={styles.statusItem}><strong>Energia Interna (u)</strong><span>{data.pontos[0].u.toFixed(2)} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
                <div className={styles.statusItem}><strong>Entalpia (h)</strong><span>{data.pontos[0].h.toFixed(2)} <small style={{color:'var(--text3)'}}>kJ/kg</small></span></div>
                <div className={styles.statusItem}><strong>Entropia (s)</strong><span>{data.pontos[0].s.toFixed(4)} <small style={{color:'var(--text3)'}}>kJ/kg·K</small></span></div>
              </div>
              
              <div className={styles.memorialText} style={{marginTop: '20px', background: 'var(--bg2)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)'}}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '10px'}}>MEMORIAL DE CÁLCULO E ANÁLISE DO CICLO:</strong>
                {data.memorial_list.map((line, i) => {
                  const isTitle = line.startsWith("[");
                  const isSubtitle = line.startsWith("➤");
                  return (
                    <div key={i} className={styles.memorialLine} style={{ 
                        marginLeft: (!isTitle && !isSubtitle) ? '15px' : '0', 
                        color: isTitle ? 'var(--accent)' : isSubtitle ? 'var(--text)' : 'var(--text2)',
                        marginTop: isTitle ? '15px' : '3px',
                        fontWeight: (isTitle || isSubtitle) ? 'bold' : 'normal',
                        fontFamily: 'var(--font-mono)'
                    }}>
                      {line}
                    </div>
                  );
                })}
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