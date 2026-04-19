import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { satT, satP } from './data';

export default function RankineChart({ pontos, inputT, inputP }) {
  const svgRef = useRef();

  const domeData = useMemo(() => {
    if (!satT || satT.length === 0) return [];
    const validRows = satT.filter(row => typeof row[6] === 'number' && typeof row[7] === 'number');
    const left = validRows.map(row => ({ s: row[6], T: row[0] }));
    const right = [...validRows].reverse().map(row => ({ s: row[7], T: row[0] }));
    return [...left, ...right];
  }, []);

  useEffect(() => {
    if (!pontos || domeData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    d3.select(".d3-tooltip").remove(); 
    const tooltip = d3.select("body").append("div")
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
      .style("z-index", 100)
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.2)");

    const width = svgRef.current.parentElement.clientWidth || 800;
    const height = 450;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const maxT = Math.max(400, pontos[0].T + 50);
    const maxS = Math.max(10, pontos[0].s + 1);

    const x = d3.scaleLinear().domain([0, maxS]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, maxT]).range([innerHeight, 0]);

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x)).attr("color", "#64748b");
    g.append("g").call(d3.axisLeft(y)).attr("color", "#64748b");

    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3")).call(d3.axisBottom(x).tickSize(innerHeight).tickFormat(""));
    g.append("g").attr("class", "grid").attr("color", "rgba(51, 65, 85, 0.4)").style("stroke-dasharray", ("3,3")).call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""));

    const domeLine = d3.line().x(d => x(d.s)).y(d => y(d.T)).curve(d3.curveMonotoneX);
    g.append("path").datum(domeData).attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2).attr("d", domeLine);

    const drawCycle = (pointsData, color, isReference, title) => {
        const cycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));
        
        g.append("path")
            .datum(pointsData)
            .attr("fill", isReference ? "transparent" : `${color}15`)
            .attr("stroke", color)
            .attr("stroke-width", isReference ? 1.5 : 2.5)
            .attr("stroke-dasharray", isReference ? "4,4" : "none")
            .style("opacity", isReference ? 0.4 : 1)
            .attr("d", cycleLine);

        const safeClass = title.replace(/[^a-zA-Z0-9]/g, '');

        g.selectAll(`.nodes-${safeClass}`)
            .data(pointsData.filter(p => typeof p.id === 'number' || typeof p.id === 'string'))
            .enter().append("circle").attr("cx", d => x(d.s)).attr("cy", d => y(d.T)).attr("r", isReference ? 3 : 5)
            .attr("fill", "var(--bg)").attr("stroke", color).attr("stroke-width", isReference ? 1.5 : 2).style("opacity", isReference ? 0.4 : 1).style("cursor", "crosshair")
            .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 8).attr("fill", color).style("opacity", 1); })
            .on("mousemove", function(event, d) {
                tooltip.html(`<strong style="color:${color}">${title} (Nó ${d.id})</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                       .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", isReference ? 3 : 5).attr("fill", "var(--bg)").style("opacity", isReference ? 0.4 : 1); });
    };

    const getSat = (T_val) => satT.find(r => r[0] >= T_val) || satT[satT.length-1];

    const ptHighR = getSat(300); const ptLowR = getSat(50);
    drawCycle([
        { id: 'R1', s: ptHighR[7], T: 300 }, { id: 'R2', s: ptHighR[7], T: 50 }, { id: 'R3', s: ptLowR[6], T: 50 },
        { id: 'R4', s: ptLowR[6], T: 55 }, { id: 'R4a', s: ptHighR[6], T: 300 }, { id: 'R1', s: ptHighR[7], T: 300 }
    ], "#3b82f6", true, "Ref: Rankine");

    const ptHighC = getSat(250); const ptLowC = getSat(100);
    drawCycle([
        { id: 'C1', s: ptHighC[7], T: 250 }, { id: 'C2', s: ptHighC[7], T: 100 }, { id: 'C3', s: ptHighC[6], T: 100 },
        { id: 'C4', s: ptHighC[6], T: 250 }, { id: 'C1', s: ptHighC[7], T: 250 }
    ], "#f59e0b", true, "Ref: Carnot");

    let currentTsat = pontos[0].T;
    const pBar = parseFloat(inputP) / 100; 
    if (pBar <= satP[0][0]) currentTsat = satP[0][1];
    else if (pBar >= satP[satP.length-1][0]) currentTsat = satP[satP.length-1][1];
    else {
        const closestSatP = satP.reduce((prev, curr) => Math.abs(curr[0] - pBar) < Math.abs(prev[0] - pBar) ? curr : prev);
        currentTsat = closestSatP[1];
    }

    const ptBoiler = getSat(currentTsat);
    const sf_boiler = ptBoiler[6];
    const sg_boiler = ptBoiler[7];

    const userCycle = [
        { id: 1, s: pontos[0].s, T: pontos[0].T },
        { id: 2, s: pontos[1].s, T: pontos[1].T },
        { id: 3, s: pontos[2].s, T: pontos[2].T },
        { id: 4, s: pontos[3].s, T: pontos[3].T },
        { id: '4a', s: sf_boiler, T: currentTsat }
    ];
    
    if (pontos[0].T > currentTsat + 0.1) {
        userCycle.push({ id: '4b', s: sg_boiler, T: currentTsat });
    }
    userCycle.push({ id: 1, s: pontos[0].s, T: pontos[0].T });

    drawCycle(userCycle, "#10b981", false, "Seu Ciclo");

    g.selectAll(".cycle-labels")
      .data(pontos)
      .enter().append("text")
      .attr("x", (d, i) => x(d.s) + (i === 1 || i === 2 ? -15 : 10))
      .attr("y", d => y(d.T) - 8)
      .text((d, i) => i + 1)
      .style("fill", "#10b981").style("font-family", "var(--font-mono)").style("font-weight", "bold");

  }, [pontos, domeData, inputP]);

  return (
    <div style={{ width: '100%' }}>
      {/* TEXTO DE REFERÊNCIA FÍSICA REMOVIDO DO CABEÇALHO */}
      <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '15px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>Diagrama T-s</span>
      </div>
      <div style={{ width: '100%', height: '450px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '20px', height: '2px', borderBottom: '2px dashed #64748b' }}></span> Cúpula</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span> Seu Ciclo Rankine</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', opacity: 0.4 }}></span> Ref. Rankine</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', opacity: 0.4 }}></span> Ref. Carnot</div>
      </div>
    </div>
  );
}