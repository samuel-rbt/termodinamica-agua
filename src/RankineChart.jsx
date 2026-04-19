import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { satT } from './data';

export default function RankineChart({ pontos, satCaldeira }) {
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
    d3.selectAll(".d3-tooltip").remove(); 

    const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip")
      .style("position", "absolute").style("background", "var(--bg2)").style("color", "var(--text)")
      .style("padding", "8px 12px").style("border", "1px solid var(--border2)").style("border-radius", "6px")
      .style("font-size", "12px").style("pointer-events", "none").style("opacity", 0).style("z-index", 100)
      .style("box-shadow", "0 4px 6px -1px rgba(0,0,0,0.2)");

    const width = svgRef.current.parentElement.clientWidth || 800;
    const height = 450;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Calcula a escala exata baseada em TUDO para o gráfico nunca cortar
    const allS = [...pontos.map(p => p.s), ...domeData.map(d => d.s)];
    const allT = [...pontos.map(p => p.T), ...domeData.map(d => d.T)];

    const sMin = Math.min(...allS), sMax = Math.max(...allS);
    const tMin = Math.min(...allT), tMax = Math.max(...allT);
    const sBuffer = (sMax - sMin) * 0.05;
    const tBuffer = (tMax - tMin) * 0.05;

    const x = d3.scaleLinear().domain([Math.max(0, sMin - sBuffer), sMax + sBuffer]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([Math.max(0, tMin - tBuffer), tMax + tBuffer]).range([innerHeight, 0]);

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x)).attr("color", "#64748b");
    g.append("g").call(d3.axisLeft(y)).attr("color", "#64748b");

    const domeLine = d3.line().x(d => x(d.s)).y(d => y(d.T)).curve(d3.curveMonotoneX);
    g.append("path").datum(domeData).attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2).attr("d", domeLine);

    const drawReferenceCycle = (pointsData, color) => {
        const cycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));
        g.append("path").datum(pointsData).attr("fill", "transparent")
            .attr("stroke", color).attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,4").style("opacity", 0.4).attr("d", cycleLine);
    };

    // Desenho físico contínuo da curva (Acompanha a Cúpula e Sobe)
    const visualPath = [pontos[0], pontos[1], pontos[2], pontos[3]];
    if (pontos[0].T > satCaldeira.T + 0.1) {
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sf });
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sg });
    } else if (pontos[0].T === satCaldeira.T) {
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sf });
    }
    visualPath.push(pontos[0]); 

    const realCycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));
    g.append("path").datum(visualPath).attr("fill", "rgba(16, 185, 129, 0.15)")
        .attr("stroke", "#10b981").attr("stroke-width", 2.5).attr("d", realCycleLine);

    // Bolinhas interativas (SOMENTE 1, 2, 3 e 4)
    g.selectAll(".real-nodes").data(pontos)
        .enter().append("circle").attr("cx", d => x(d.s)).attr("cy", d => y(d.T)).attr("r", 5)
        .attr("fill", "var(--bg)").attr("stroke", "#10b981").attr("stroke-width", 2).style("cursor", "crosshair")
        .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 8).attr("fill", "#10b981"); })
        .on("mousemove", function(event, d) {
            tooltip.html(`<strong style="color:#10b981">Ponto ${d.id}</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                   .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
        })
        .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 5).attr("fill", "var(--bg)"); });

    // Textos interativos (SOMENTE 1, 2, 3 e 4)
    g.selectAll(".cycle-labels").data(pontos).enter().append("text")
      .attr("x", d => x(d.s) + (d.id === 2 || d.id === 3 ? -15 : 10)).attr("y", d => y(d.T) - 8)
      .text(d => d.id).style("fill", "#10b981").style("font-family", "var(--font-mono)").style("font-weight", "bold");

    const getSat = (T_val) => satT.find(r => r[0] >= T_val) || satT[satT.length-1];
    const ptHighR = getSat(300); const ptLowR = getSat(50);
    drawReferenceCycle([
        { s: ptHighR[7], T: 300 }, { s: ptHighR[7], T: 50 }, { s: ptLowR[6], T: 50 },
        { s: ptLowR[6], T: 55 }, { s: ptHighR[6], T: 300 }, { s: ptHighR[7], T: 300 }
    ], "#3b82f6");

    const ptHighC = getSat(250); const ptLowC = getSat(100);
    drawReferenceCycle([
        { s: ptHighC[7], T: 250 }, { s: ptHighC[7], T: 100 }, { s: ptHighC[6], T: 100 },
        { s: ptHighC[6], T: 250 }, { s: ptHighC[7], T: 250 }
    ], "#f59e0b");

  }, [pontos, domeData, satCaldeira]);

  return (
    <div style={{ width: '100%' }}>
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