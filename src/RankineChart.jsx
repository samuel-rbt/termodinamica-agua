import React from 'react';
import {
  Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend, Title
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { satT } from './data';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

// Recebe o resultado da busca para ajustar o T_high dinamicamente
export default function RankineChart({ currentResult, currentTab }) {
  
  const domeLeft = satT.map(row => ({ x: row[6], y: row[0] }));
  const domeRight = [...satT].reverse().map(row => ({ x: row[7], y: row[0] }));
  const domeData = [...domeLeft, ...domeRight];

  // Lógica dinâmica: Se o usuário pesquisar algo, o ciclo ajusta o teto (T_high)
  let T_high = 200; // Padrão
  if (currentResult && !currentResult.error) {
    if (currentTab === 'sat-t') T_high = currentResult.rawVal;
    if (currentTab === 'sat-p') T_high = currentResult.rawVal; // Usa o Tsat
  }
  
  const T_low = 40; // Temperatura do condensador fixada para o exemplo visual

  // Função simples para achar as entropias baseadas na temperatura
  const getS = (T) => {
    const row = satT.find(r => r[0] >= T) || satT[satT.length-1];
    return { sf: row[6], sg: row[7] };
  };

  const sHigh = getS(T_high);
  const sLow = getS(T_low);

  const cycleData = [
    { x: sHigh.sg, y: T_high }, // 1. Saída Caldeira
    { x: sHigh.sg, y: T_low },  // 2. Saída Turbina (Isentrópica)
    { x: sLow.sf,  y: T_low },  // 3. Saída Condensador
    { x: sLow.sf,  y: T_low + 2 }, // 4. Saída Bomba
    { x: sHigh.sf, y: T_high }, // Aquecimento sensível
    { x: sHigh.sg, y: T_high }  // 1. Fervura
  ];

  const data = {
    datasets: [
      {
        label: `Ciclo Ideal de Rankine (Tmax = ${T_high.toFixed(1)} °C)`,
        data: cycleData,
        borderColor: '#ffa726',
        backgroundColor: '#ffa726',
        showLine: true,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0,
      },
      {
        label: 'Cúpula de Saturação',
        data: domeData,
        borderColor: '#556070',
        backgroundColor: 'transparent',
        showLine: true,
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [5, 5], 
        tension: 0.1,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear', position: 'bottom',
        title: { display: true, text: 'Entropia s [kJ/(kg·K)]', color: '#8a93a6' },
        grid: { color: '#2a2f3a' }, ticks: { color: '#8a93a6' }
      },
      y: {
        title: { display: true, text: 'Temperatura T [°C]', color: '#8a93a6' },
        grid: { color: '#2a2f3a' }, ticks: { color: '#8a93a6' },
        min: 0, max: 400
      }
    },
    plugins: {
      legend: { labels: { color: '#e8ecf2' } },
      tooltip: { callbacks: { label: (ctx) => `s: ${ctx.parsed.x.toFixed(4)}, T: ${ctx.parsed.y} °C` } }
    }
  };

  return (
    <div style={{ height: '400px', width: '100%', padding: '1.5rem', background: '#13161b', borderRadius: '8px', border: '1px solid #363d4d', marginBottom: '1.5rem' }}>
      <Scatter data={data} options={options} />
    </div>
  );
}