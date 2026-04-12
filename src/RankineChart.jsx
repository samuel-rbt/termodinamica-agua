import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { satT } from './data';

export default function RankineChart({ analysis, currentResult }) {
  const svgRef = useRef();
  const wrapperRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 450 });

  // Prepara os dados da Cúpula de Saturação
  const domeData = useMemo(() => {
    if (!satT || satT.length === 0) return [];
    const validRows = satT.filter(row => typeof row[6] === 'number' && typeof row[7] === 'number');
    const left = validRows.map(row => ({ s: row[6], T: row[0] }));
    const right = [...validRows].reverse().map(row => ({ s: row[7], T: row[0] }));
    return [...left, ...right];
  }, []);

  // Resize dinâmico
  useEffect(() => {
    const observeTarget = wrapperRef.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: 450
        });
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  // Lógica principal do D3
  useEffect(() => {
    const { width, height } = dimensions;
    if (width === 0 || domeData.length === 0) return;

    // Limpa renderizações anteriores do SVG e do Tooltip
    const container = d3.select(wrapperRef.current);
    container.select("svg").selectAll("*").remove(); 
    container.selectAll(".d3-tooltip").remove(); 

    // --- CRIAÇÃO DO TOOLTIP FLUTUANTE ---
    const tooltip = container.append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("background", "var(--bg2)")
      .style("color", "var(--text)")
      .style("padding", "8px 12px")
      .style("border", "1px solid var(--border2)")
      .style("border-radius", "6px")
      .style("font-family", "var(--font-mono)")
      .style("font-size", "12px")
      .style("pointer-events", "none") // Impede que o mouse bugue ao passar por cima do texto
      .style("opacity", 0)
      .style("z-index", 10)
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.2)");

    const svg = container.select("svg");
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    let currentT = 100;
    let currentS = 0;

    if (analysis) {
        currentT = Number(analysis.T) || 100;
        if (analysis.s_val !== undefined && analysis.s_val !== null) {
            currentS = Array.isArray(analysis.s_val) ? Number(analysis.s_val[1]) : Number(analysis.s_val);
        }
    } else if (currentResult && currentResult.values) {
        currentT = Number(currentResult.values[0]) || 100;
        if (currentResult.keys) {
            const sIndex = currentResult.keys.indexOf('s');
            const sgIndex = currentResult.keys.indexOf('sg');
            if (sIndex !== -1) currentS = Number(currentResult.values[sIndex]);
            else if (sgIndex !== -1) currentS = Number(currentResult.values[sgIndex]);
        }
    }
    
    currentT = isNaN(currentT) ? 100 : currentT;
    currentS = isNaN(currentS) ? 0 : currentS;

    const domainMaxT = Math.max(400, currentT + 30);
    const domainMaxS = Math.max(10, currentS + 1);

    const xScale = d3.scaleLinear().domain([0, domainMaxS]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, domainMaxT]).range([innerHeight, 0]);

    const safeX = (val) => { const res = xScale(val); return isNaN(res) ? 0 : res; };
    const safeY = (val) => { const res = yScale(val); return isNaN(res) ? 0 : res; };

    // --- EIXOS E GRID ---
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(10))
      .attr("color", "#64748b")
      .selectAll("text").style("font-family", "var(--font-mono)").style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(10))
      .attr("color", "#64748b")
      .selectAll("text").style("font-family", "var(--font-mono)").style("font-size", "11px");

    g.append("text")
      .attr("x", innerWidth / 2).attr("y", innerHeight + margin.bottom - 10)
      .style("text-anchor", "middle").style("fill", "#94a3b8").style("font-family", "var(--font-sans)")
      .style("font-size", "13px").style("font-weight", "500").text("Entropia, s (kJ/kg·K)");

    g.append("text")
      .attr("transform", "rotate(-90)").attr("y", -margin.left + 15).attr("x", -innerHeight / 2)
      .style("text-anchor", "middle").style("fill", "#94a3b8").style("font-family", "var(--font-sans)")
      .style("font-size", "13px").style("font-weight", "500").text("Temperatura, T (°C)");

    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3"))
        .call(d3.axisBottom(xScale).tickSize(innerHeight).tickFormat(""));
    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3"))
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(""));

    const lineGenerator = d3.line().x(d => safeX(d.s)).y(d => safeY(d.T)).curve(d3.curveMonotoneX);

    // --- 1. CÚPULA DE SATURAÇÃO ---
    g.append("path").datum(domeData).attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2).attr("d", lineGenerator);

    // --- FUNÇÃO PARA DESENHAR CICLOS ---
    const drawCycle = (points, color, label, titleText) => {
        g.append("path").datum(points).attr("fill", "transparent").attr("stroke", color)
            .attr("stroke-width", 2).attr("stroke-dasharray", "5,5").attr("d", lineGenerator);

        g.selectAll(`.cycle-nodes-${label}`)
            .data(points.filter(p => typeof p.id === 'number'))
            .enter()
            .append("circle")
            .attr("cx", d => safeX(d.s))
            .attr("cy", d => safeY(d.T))
            .attr("r", 5)
            .attr("fill", "var(--bg)")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .style("cursor", "crosshair")
            // EVENTOS DO TOOLTIP
            .on("mouseover", function() {
                tooltip.style("opacity", 1);
                d3.select(this).attr("r", 7).attr("fill", color); // Efeito hover
            })
            .on("mousemove", function(event, d) {
                const [x, y] = d3.pointer(event, wrapperRef.current);
                tooltip.html(`<strong style="color:${color}">${titleText} (Nó ${d.id})</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                       .style("left", (x + 15) + "px")
                       .style("top", (y - 15) + "px");
            })
            .on("mouseleave", function() {
                tooltip.style("opacity", 0);
                d3.select(this).attr("r", 5).attr("fill", "var(--bg)"); // Reseta efeito
            });
    };

    const getSat = (T) => satT.find(r => r[0] >= T) || satT[satT.length-1];

    // --- 2. RANKINE IDEAL ---
    const tHighR = 300; const tLowR = 50;
    const ptHighR = getSat(tHighR); const ptLowR = getSat(tLowR);
    const s1 = ptHighR[7]; 
    const rankinePts = [
        { id: 1, s: s1, T: tHighR }, { id: 2, s: s1, T: tLowR }, 
        { id: 3, s: ptLowR[6], T: tLowR }, { id: 4, s: ptLowR[6], T: tLowR + 5 }, 
        { id: '4a', s: ptHighR[6], T: tHighR }, { id: 1, s: s1, T: tHighR }
    ];
    drawCycle(rankinePts, "#3b82f6", "rankine", "Rankine Ideal");

    // --- 3. CARNOT ---
    const tHighC = 250; const tLowC = 100;
    const ptHighC = getSat(tHighC); const ptLowC = getSat(tLowC);
    const carnotPts = [
        { id: 1, s: ptHighC[7], T: tHighC }, { id: 2, s: ptHighC[7], T: tLowC },
        { id: 3, s: ptHighC[6], T: tLowC }, { id: 4, s: ptHighC[6], T: tHighC },
        { id: 1, s: ptHighC[7], T: tHighC }
    ];
    drawCycle(carnotPts, "#f59e0b", "carnot", "Carnot");

    // --- 4. SEU PONTO CALCULADO ---
    if (analysis && analysis.s_val !== undefined && analysis.s_val !== null) {
      const isMixture = Array.isArray(analysis.s_val);
      const pointColor = analysis.color || "#10b981";
      
      if (isMixture) {
        const s0 = Number(analysis.s_val[0]) || 0;
        const s1 = Number(analysis.s_val[1]) || 0;

        g.append("line").attr("x1", safeX(s0)).attr("y1", safeY(currentT)).attr("x2", safeX(s1)).attr("y2", safeY(currentT)).attr("stroke", pointColor).attr("stroke-width", 2.5).attr("stroke-dasharray", "4,4");
        
        g.selectAll(".mix-points").data([s0, s1]).enter().append("circle").attr("cx", d => safeX(d)).attr("cy", safeY(currentT)).attr("r", 5).attr("fill", pointColor).attr("stroke", "#0f172a").attr("stroke-width", 2).style("cursor", "crosshair")
          .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 8); })
          .on("mousemove", function(event, d) {
              const [x, y] = d3.pointer(event, wrapperRef.current);
              tooltip.html(`<strong style="color:${pointColor}">Seu Ponto (Mistura)</strong><br/>T: ${currentT.toFixed(2)} °C<br/>s: ${d.toFixed(4)}`)
                     .style("left", (x + 15) + "px").style("top", (y - 15) + "px");
          })
          .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 5); });
          
      } else {
        g.append("line").attr("x1", safeX(currentS)).attr("y1", safeY(currentT)).attr("x2", safeX(currentS)).attr("y2", innerHeight).attr("stroke", pointColor).attr("stroke-width", 1).attr("stroke-dasharray", "2,2").style("opacity", 0.5);
        g.append("line").attr("x1", safeX(currentS)).attr("y1", safeY(currentT)).attr("x2", 0).attr("y2", safeY(currentT)).attr("stroke", pointColor).attr("stroke-width", 1).attr("stroke-dasharray", "2,2").style("opacity", 0.5);
        
        g.append("circle").datum({ T: currentT, s: currentS }).attr("cx", safeX(currentS)).attr("cy", safeY(currentT)).attr("r", 6).attr("fill", pointColor).attr("stroke", "#fff").attr("stroke-width", 2).style("cursor", "crosshair")
          .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 9); })
          .on("mousemove", function(event, d) {
              const [x, y] = d3.pointer(event, wrapperRef.current);
              tooltip.html(`<strong style="color:${pointColor}">Seu Ponto Solicitado</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                     .style("left", (x + 15) + "px").style("top", (y - 15) + "px");
          })
          .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 6); });
      }
    }

  }, [dimensions, analysis, currentResult, domeData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>
                    Diagrama T-s
                </span>
            </div>
        </div>

        <div ref={wrapperRef} style={{ width: '100%', height: '450px', position: 'relative', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <svg ref={svgRef} width="100%" height="100%"></svg>
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '2px', borderBottom: '2px dashed #64748b' }}></span> Cúpula de Saturação
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }}></span> Seu Ponto
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></span> Rankine Ideal
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span> Carnot
            </div>
        </div>
    </div>
  );
}