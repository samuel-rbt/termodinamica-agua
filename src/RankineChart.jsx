import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { satT, satP } from './data';

export default function RankineChart({ analysis, currentResult }) {
  const svgRef = useRef();
  const wrapperRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 450 });

  const domeData = useMemo(() => {
    if (!satT || satT.length === 0) return [];
    const validRows = satT.filter(row => typeof row[6] === 'number' && typeof row[7] === 'number');
    const left = validRows.map(row => ({ s: row[6], T: row[0] }));
    const right = [...validRows].reverse().map(row => ({ s: row[7], T: row[0] }));
    return [...left, ...right];
  }, []);

  useEffect(() => {
    const observeTarget = wrapperRef.current;
    if (!observeTarget) return;
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({ width: entries[0].contentRect.width, height: 450 });
      }
    });
    resizeObserver.observe(observeTarget);
    return () => resizeObserver.unobserve(observeTarget);
  }, []);

  useEffect(() => {
    const { width, height } = dimensions;
    if (width === 0 || domeData.length === 0) return;

    const container = d3.select(wrapperRef.current);
    container.select("svg").selectAll("*").remove(); 
    container.selectAll(".d3-tooltip").remove(); 

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
      .style("pointer-events", "none") 
      .style("opacity", 0)
      .style("z-index", 10)
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.2)");

    const svg = container.select("svg");
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    let currentT = 100;
    let currentS = 0;
    const hasUserPoint = analysis && analysis.s_val !== undefined && analysis.s_val !== null;

    if (hasUserPoint) {
        currentT = Number(analysis.T) || 100;
        currentS = Array.isArray(analysis.s_val) ? Number(analysis.s_val[1]) : Number(analysis.s_val);
    }
    
    currentT = isNaN(currentT) ? 100 : currentT;
    currentS = isNaN(currentS) ? 0 : currentS;

    const domainMaxT = Math.max(400, currentT + 50); 
    const domainMaxS = Math.max(10, currentS + 1);

    const xScale = d3.scaleLinear().domain([0, domainMaxS]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, domainMaxT]).range([innerHeight, 0]);

    const safeX = (val) => { const res = xScale(val); return isNaN(res) ? 0 : res; };
    const safeY = (val) => { const res = yScale(val); return isNaN(res) ? 0 : res; };

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale).ticks(10)).attr("color", "#64748b")
      .selectAll("text").style("font-family", "var(--font-mono)").style("font-size", "11px");

    g.append("g").call(d3.axisLeft(yScale).ticks(10)).attr("color", "#64748b")
      .selectAll("text").style("font-family", "var(--font-mono)").style("font-size", "11px");

    g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + margin.bottom - 10)
      .style("text-anchor", "middle").style("fill", "#94a3b8").style("font-family", "var(--font-sans)").style("font-size", "13px").text("Entropia, s (kJ/kg·K)");

    g.append("text").attr("transform", "rotate(-90)").attr("y", -margin.left + 15).attr("x", -innerHeight / 2)
      .style("text-anchor", "middle").style("fill", "#94a3b8").style("font-family", "var(--font-sans)").style("font-size", "13px").text("Temperatura, T (°C)");

    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3")).call(d3.axisBottom(xScale).tickSize(innerHeight).tickFormat(""));
    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3")).call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(""));

    // O Segredo: DOIS tipos de Lápis. Um curva para a Cúpula, outro reto para os Ciclos!
    const domeLineGenerator = d3.line().x(d => safeX(d.s)).y(d => safeY(d.T)).curve(d3.curveMonotoneX);
    const cycleLineGenerator = d3.line().x(d => safeX(d.s)).y(d => safeY(d.T)); // Sem curva suave, mantém as retas retas.

    // --- 0. CÚPULA DE SATURAÇÃO ---
    g.append("path").datum(domeData).attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2).attr("d", domeLineGenerator);

    const drawCycle = (points, color, label, titleText, isReference = false) => {
        g.append("path")
            .datum(points)
            .attr("fill", isReference ? "transparent" : color)
            .style("fill-opacity", isReference ? 0 : 0.1) // Substituí a gambiarra de cor hexadecimal para evitar erros visuais
            .attr("stroke", color)
            .attr("stroke-width", isReference ? 1.5 : 2.5)
            .attr("stroke-dasharray", isReference ? "4,4" : "none")
            .style("opacity", isReference ? 0.4 : 1) 
            .attr("d", cycleLineGenerator);

        g.selectAll(`.cycle-nodes-${label}`)
            .data(points.filter(p => typeof p.id === 'number' || typeof p.id === 'string'))
            .enter().append("circle").attr("cx", d => safeX(d.s)).attr("cy", d => safeY(d.T)).attr("r", isReference ? 3 : 5)
            .attr("fill", "var(--bg)").attr("stroke", color).attr("stroke-width", isReference ? 1.5 : 2).style("opacity", isReference ? 0.4 : 1).style("cursor", "crosshair")
            .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 8).attr("fill", color).style("opacity", 1); })
            .on("mousemove", function(event, d) {
                const [x, y] = d3.pointer(event, wrapperRef.current);
                tooltip.html(`<strong style="color:${color}">${titleText} (Nó ${d.id})</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                       .style("left", (x + 15) + "px").style("top", (y - 15) + "px");
            })
            .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", isReference ? 3 : 5).attr("fill", "var(--bg)").style("opacity", isReference ? 0.4 : 1); });
            
        if (!isReference) {
            g.selectAll(`.cycle-labels-${label}`)
                .data(points.filter(p => typeof p.id === 'number'))
                .enter().append("text")
                .attr("x", d => safeX(d.s) + (d.id === 2 || d.id === 3 ? -14 : 10))
                .attr("y", d => safeY(d.T) - 8)
                .text(d => d.id)
                .style("fill", color)
                .style("font-family", "var(--font-mono)")
                .style("font-size", "14px")
                .style("font-weight", "bold");
        }
    };

    const getSat = (T) => satT.find(r => r[0] >= T) || satT[satT.length-1];

    // --- 1. RANKINE E CARNOT (REFERÊNCIAS) ---
    const tHighR = 300; const tLowR = 50;
    const ptHighR = getSat(tHighR); const ptLowR = getSat(tLowR);
    const rankinePts = [
        { id: 'R1', s: ptHighR[7], T: tHighR }, { id: 'R2', s: ptHighR[7], T: tLowR }, 
        { id: 'R3', s: ptLowR[6], T: tLowR }, { id: 'R4', s: ptLowR[6], T: tLowR + 5 }, 
        { id: 'R4a', s: ptHighR[6], T: tHighR }, { id: 'R1', s: ptHighR[7], T: tHighR }
    ];
    drawCycle(rankinePts, "#3b82f6", "ref-rankine", "Ref: Rankine Ideal", true);

    const tHighC = 250; const tLowC = 100;
    const ptHighC = getSat(tHighC);
    const carnotPts = [
        { id: 'C1', s: ptHighC[7], T: tHighC }, { id: 'C2', s: ptHighC[7], T: tLowC },
        { id: 'C3', s: ptHighC[6], T: tLowC }, { id: 'C4', s: ptHighC[6], T: tHighC },
        { id: 'C1', s: ptHighC[7], T: tHighC }
    ];
    drawCycle(carnotPts, "#f59e0b", "ref-carnot", "Ref: Carnot", true);

    // --- 3. O SEU CICLO ---
    if (hasUserPoint) {
        let currentTsat = currentT;
        let currentP = 0;
        
        if (currentResult && currentResult.keys) {
            const pIdx = currentResult.keys.indexOf('P');
            if (pIdx !== -1) currentP = Number(currentResult.values[pIdx]); // Agora em kPa
        }
        
        if (currentP > 0) {
            const pBar = currentP / 100; // kPa para Bar
            if (pBar <= satP[0][0]) currentTsat = satP[0][1];
            else if (pBar >= satP[satP.length-1][0]) currentTsat = satP[satP.length-1][1];
            else {
                const closestSatP = satP.reduce((prev, curr) => Math.abs(curr[0] - pBar) < Math.abs(prev[0] - pBar) ? curr : prev);
                currentTsat = closestSatP[1];
            }
        }

        let tLow = 50; 
        if (currentTsat <= 60) tLow = Math.max(0.01, currentTsat - 20);

        const ptLow = getSat(tLow);
        const s3 = ptLow[6]; 
        const ptBoiler = getSat(currentTsat);
        const sf_boiler = ptBoiler[6];
        const sg_boiler = ptBoiler[7];

        const userColor = analysis.color || "#10b981";

        const userCycle = [
            { id: 1, s: currentS, T: currentT },            
            { id: 2, s: currentS, T: tLow },                
            { id: 3, s: s3, T: tLow },                      
            { id: 4, s: s3, T: tLow + 5 },                  
            { id: '4a', s: sf_boiler, T: currentTsat }      
        ];
        
        if (currentT > currentTsat + 0.1) {
            userCycle.push({ id: '4b', s: sg_boiler, T: currentTsat });
        }
        userCycle.push({ id: 1, s: currentS, T: currentT }); 

        drawCycle(userCycle, userColor, "user-cycle", "Seu Ciclo Calculado", false);
    }

  }, [dimensions, analysis, currentResult, domeData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>Diagrama T-s</span>
                <span style={{ fontSize: '12px', color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '12px' }}>
                    {analysis ? "Seu Ciclo Calculado + Referências" : "Modelos de Referência"}
                </span>
            </div>
        </div>

        <div ref={wrapperRef} style={{ width: '100%', height: '450px', position: 'relative', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <svg ref={svgRef} width="100%" height="100%"></svg>
        </div>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '20px', height: '2px', borderBottom: '2px dashed #64748b' }}></span> Cúpula</div>
            {analysis && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: analysis.color || 'var(--accent)' }}></span> Seu Ciclo</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', opacity: 0.4 }}></span> Ref. Rankine</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', opacity: 0.4 }}></span> Ref. Carnot</div>
        </div>
    </div>
  );
}