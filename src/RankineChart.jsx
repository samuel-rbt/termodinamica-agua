import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { satT } from './data';

export default function RankineChart({ pontos, satCaldeira, cycleColor, onDragNode }) {
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
    
    // Limpeza apenas do Tooltip (SVG não é apagado para manter o Drag ativo sem quebrar)
    d3.selectAll(".d3-tooltip").remove(); 
    const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip")
      .style("position", "absolute").style("background", "var(--bg2)").style("color", "var(--text)")
      .style("padding", "8px 12px").style("border", "1px solid var(--border2)").style("border-radius", "6px")
      .style("font-size", "12px").style("pointer-events", "none").style("opacity", 0).style("z-index", 100);

    const width = svgRef.current.parentElement.clientWidth || 800;
    const height = 450;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // --- 1. INITIALIZATION (Roda apenas 1 vez para construir o esqueleto) ---
    if (svg.select(".main-group").empty()) {
        const gInit = svg.append("g").attr("class", "main-group").attr("transform", `translate(${margin.left},${margin.top})`);
        gInit.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
        gInit.append("g").attr("class", "y-axis");
        gInit.append("g").attr("class", "grid x-grid").style("stroke-dasharray", "3,3").attr("color", "rgba(51, 65, 85, 0.2)");
        gInit.append("g").attr("class", "grid y-grid").style("stroke-dasharray", "3,3").attr("color", "rgba(51, 65, 85, 0.2)");
        gInit.append("path").attr("class", "dome-path").attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2);
        
        // Ciclos de Referência Acadêmica
        const getSat = (T_val) => satT.find(r => r[0] >= T_val) || satT[satT.length-1];
        const ptHighR = getSat(300); const ptLowR = getSat(50);
        const refR = [ { s: ptHighR[7], T: 300 }, { s: ptHighR[7], T: 50 }, { s: ptLowR[6], T: 50 }, { s: ptLowR[6], T: 55 }, { s: ptHighR[6], T: 300 }, { s: ptHighR[7], T: 300 } ];
        gInit.append("path").datum(refR).attr("class", "ref-r").attr("fill", "transparent").attr("stroke", "#3b82f6").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4").style("opacity", 0.3);
        
        const ptHighC = getSat(250); const ptLowC = getSat(100);
        const refC = [ { s: ptHighC[7], T: 250 }, { s: ptHighC[7], T: 100 }, { s: ptHighC[6], T: 100 }, { s: ptHighC[6], T: 250 }, { s: ptHighC[7], T: 250 } ];
        gInit.append("path").datum(refC).attr("class", "ref-c").attr("fill", "transparent").attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4").style("opacity", 0.3);
    }

    const g = svg.select(".main-group");

    // --- 2. ESCALAS FÍSICAS (Baseadas no teto máximo para o mouse não fugir no drag) ---
    const allS = [...pontos.map(p => p.s), ...domeData.map(d => d.s)];
    const allT = [...pontos.map(p => p.T), ...domeData.map(d => d.T)];
    const fixedSMax = Math.max(9, ...allS);
    const fixedTMax = Math.max(400, ...allT);

    const x = d3.scaleLinear().domain([0, fixedSMax + 0.5]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, fixedTMax + 20]).range([innerHeight, 0]);

    // Atualiza Eixos dinamicamente
    g.select(".x-axis").call(d3.axisBottom(x)).attr("color", "#64748b");
    g.select(".y-axis").call(d3.axisLeft(y)).attr("color", "#64748b");
    g.select(".x-grid").call(d3.axisBottom(x).tickSize(innerHeight).tickFormat(""));
    g.select(".y-grid").call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""));
    const domeLine = d3.line().x(d => x(d.s)).y(d => y(d.T)).curve(d3.curveMonotoneX);
    g.select(".dome-path").datum(domeData).attr("d", domeLine);

    // --- 3. TRAÇADO DO SEU CICLO (Atualiza-se em tempo real) ---
    const mainColor = cycleColor || "#10b981";
    const visualPath = [pontos[0], pontos[1], pontos[2], pontos[3]];
    if (pontos[0].T > satCaldeira.T + 0.1) {
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sf });
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sg });
    } else if (pontos[0].T === satCaldeira.T) {
        visualPath.push({ T: satCaldeira.T, s: satCaldeira.sf });
    }
    visualPath.push(pontos[0]); 

    const realCycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));
    const cyclePath = g.selectAll(".real-cycle").data([visualPath]);
    cyclePath.enter().append("path").attr("class", "real-cycle")
      .merge(cyclePath)
      .style("fill", mainColor).style("fill-opacity", 0.1) 
      .attr("stroke", mainColor).attr("stroke-width", 2.5).attr("d", realCycleLine);

    // --- 4. NÓS INTERATIVOS (Drag Engine) ---
    const nodes = g.selectAll(".real-nodes").data(pontos, d => d.id);
    nodes.enter().append("circle").attr("class", "real-nodes")
      .attr("r", 6).style("cursor", "grab")
      .merge(nodes)
      .attr("cx", d => x(d.s)).attr("cy", d => y(d.T))
      .attr("fill", "var(--bg)").attr("stroke", mainColor).attr("stroke-width", 2.5)
      .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 9).attr("fill", mainColor); })
      .on("mousemove", function(event, d) {
          tooltip.html(`<strong style="color:${mainColor}">Arraste o Ponto ${d.id}</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                 .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
      })
      .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 6).attr("fill", "var(--bg)"); })
      // D3 DRAG PHYSICS: Manda a instrução para o React calcular
      .call(d3.drag()
        .on("start", function() { d3.select(this).style("cursor", "grabbing"); })
        .on("drag", function(event, d) {
            tooltip.style("opacity", 0); // Esconde texto pra não atrapalhar a visão
            const newT = Math.max(0.1, y.invert(event.y));
            if (d.id === 1 && onDragNode) onDragNode('T_caldeira', newT);
            else if ([2, 3, 4].includes(d.id) && onDragNode) onDragNode('T_condensador', newT);
        })
        .on("end", function() { d3.select(this).style("cursor", "grab"); })
      );
    nodes.exit().remove();

    const labels = g.selectAll(".cycle-labels").data(pontos, d => d.id);
    labels.enter().append("text").attr("class", "cycle-labels")
      .merge(labels)
      .attr("x", d => x(d.s) + (d.id === 2 || d.id === 3 ? -16 : 12)).attr("y", d => y(d.T) - 8)
      .text(d => d.id).style("fill", mainColor).style("font-family", "var(--font-mono)").style("font-weight", "bold").style("font-size", "14px");
    labels.exit().remove();

  }, [pontos, domeData, satCaldeira, cycleColor, onDragNode]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cycleColor || '#10b981' }}></span> Seu Ciclo Vivo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', opacity: 0.4 }}></span> Ref. Rankine</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', opacity: 0.4 }}></span> Ref. Carnot</div>
      </div>
    </div>
  );
}