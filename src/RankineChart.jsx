import React from 'react';
import {
  Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend, Title
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { satT } from './data';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Title);


export default function RankineChart({ currentResult, currentTab }) {
  
  const domeLeft = satT.map(row => ({ x: row[6], y: row[0] }));
  const domeRight = [...satT].reverse().map(row => ({ x: row[7], y: row[0] }));
  const domeData = [...domeLeft, ...domeRight];

  
  let T_high = 200; // Temperatura Padrão
  if (currentResult && !currentResult.error && currentResult.rawVal !== undefined) {
    T_high = currentResult.rawVal;
  }
  
  const T_low = 40; // Temperatura do condensador fixada para o exemplo visual

  
  const getS = (T) => {
    
    const row = satT.find(r => r[0] >= T) || satT[satT.length-1];
    return { sf: row[6], sg: row[7] };
  };

  const sHigh = getS(T_high);
  const sLow = getS(T_low);

  const cycleData = [
    { x: sHigh.sg, y: T_high }, 
    { x: sHigh.sg, y: T_low },  
    { x: sLow.sf,  y: T_low },  
    { x: sLow.sf,  y: T_low + 2 }, 
    { x: sHigh.sf, y: T_high }, 
    { x: sHigh.sg, y: T_high }  
  ];

  const data = {
    datasets: [
      {
        label: `Ciclo Ideal (Tmax = ${T_high.toFixed(1)} °C)`,
        data: cycleData,
        borderColor: '#10b981', // Verde Esmeralda 
        backgroundColor: '#10b981',
        showLine: true,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0,
      },
      {
        label: 'Saturação',
        data: domeData,
        borderColor: '#475569', // Cinza azulado 
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
        title: { display: true, text: 'Entropia s [kJ/(kg·K)]', color: '#94a3b8' },
        grid: { color: '#334155' }, ticks: { color: '#94a3b8' }
      },
      y: {
        title: { display: true, text: 'Temperatura T [°C]', color: '#94a3b8' },
        grid: { color: '#334155' }, ticks: { color: '#94a3b8' },
        // O eixo Y 
        min: 0, max: Math.max(400, T_high + 20) 
      }
    },
    plugins: {
      legend: { labels: { color: '#f8fafc' } },
      tooltip: { callbacks: { label: (ctx) => `s: ${ctx.parsed.x.toFixed(4)}, T: ${ctx.parsed.y} °C` } }
    }
  };

  return (
    <div style={{ 
      height: '400px', 
      width: '100%', 
      padding: '1.5rem', 
      background: '#1e293b', /* Fundo do container */
      borderRadius: '12px', 
      border: '1px solid #334155', 
      marginBottom: '1.5rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
    }}>
      <Scatter data={data} options={options} />
    </div>
  );
}