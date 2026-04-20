import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { satT } from './data';

export default function RankineChart({ pontos, satAlta, satBaixa, cycleColor, onGraphDrag, onGraphDrop }) {
  const svgRef = useRef();
  
  const [localT1, setLocalT1] = useState(null);
  const [localT2, setLocalT2] = useState(null);

  const localT1Ref = useRef(null);
  const localT2Ref = useRef(null);

  useEffect(() => {
    if (pontos && pontos.length > 0) {
      localT1Ref.current = pontos[0].T;
      localT2Ref.current = pontos[1].T;
    }
  }, [pontos]);

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
    const width = svgRef.current.parentElement.clientWidth || 800;
    const height = 450;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allS = [...pontos.map(p => p.s), ...domeData.map(d => d.s)];
    const sMax = Math.max(...allS);
    const x = d3.scaleLinear().domain([0, Math.max(9, sMax + 0.5)]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, 600]).range([innerHeight, 0]);

    let g = svg.select("g.main-group");

    if (g.empty()) {
        svg.selectAll("*").remove(); 
        d3.select("body").selectAll(".d3-tooltip").remove();
        
        d3.select("body").append("div").attr("class", "d3-tooltip")
          .style("position", "absolute").style("background", "var(--bg2)").style("color", "var(--text)")
          .style("padding", "8px 12px").style("border", "1px solid var(--border2)").style("border-radius", "6px")
          .style("font-size", "12px").style("pointer-events", "none").style("opacity", 0).style("z-index", 100)
          .style("box-shadow", "0 4px 6px -1px rgba(0,0,0,0.2)").style("font-family", "var(--font-mono)");

        g = svg.append("g").attr("class", "main-group").attr("transform", `translate(${margin.left},${margin.top})`);
        
        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
        g.append("g").attr("class", "y-axis");
        g.append("g").attr("class", "grid x-grid").style("stroke-dasharray", "3,3").attr("color", "rgba(51, 65, 85, 0.2)");
        g.append("g").attr("class", "grid y-grid").style("stroke-dasharray", "3,3").attr("color", "rgba(51, 65, 85, 0.2)");
        
        g.append("path").attr("class", "dome-path").attr("fill", "rgba(71, 85, 105, 0.05)").attr("stroke", "#64748b").attr("stroke-width", 2);
        g.append("g").attr("class", "ref-cycles"); 
        
        g.append("path").attr("class", "live-line");
        g.append("g").attr("class", "live-nodes");
        g.append("g").attr("class", "live-labels");
    }

    g.select(".x-axis").call(d3.axisBottom(x)).attr("color", "#64748b");
    g.select(".y-axis").call(d3.axisLeft(y)).attr("color", "#64748b");
    g.select(".x-grid").call(d3.axisBottom(x).tickSize(innerHeight).tickFormat(""));
    g.select(".y-grid").call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""));
    
    const domeLine = d3.line().x(d => x(d.s)).y(d => y(d.T)).curve(d3.curveMonotoneX);
    g.select(".dome-path").datum(domeData).attr("d", domeLine);

    const tooltip = d3.select("body").select(".d3-tooltip");
    const mainColor = cycleColor || "#10b981";

    const drawReference = (pointsData, color, safeClass, title) => {
        const cycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));
        const refGroup = g.select(".ref-cycles");

        let path = refGroup.select(`.path-${safeClass}`);
        if (path.empty()) path = refGroup.append("path").attr("class", `path-${safeClass}`);
        path.datum(pointsData).attr("fill", "transparent").attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4").style("opacity", 0.6).attr("d", cycleLine);

        const nodes = refGroup.selectAll(`.node-${safeClass}`).data(pointsData.filter(p => p.id));
        nodes.enter().append("circle").attr("class", `node-${safeClass}`)
            .merge(nodes)
            .attr("cx", d => x(d.s)).attr("cy", d => y(d.T)).attr("r", 4)
            .attr("fill", "var(--bg)").attr("stroke", color).attr("stroke-width", 1.5).style("opacity", 0.8)
            .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 7).style("opacity", 1).attr("fill", color); })
            .on("mousemove", function(event, d) {
                tooltip.html(`<strong style="color:${color}">${title} (${d.id})</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                       .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 4).style("opacity", 0.8).attr("fill", "var(--bg)"); });
        nodes.exit().remove();

        const labels = refGroup.selectAll(`.label-${safeClass}`).data(pointsData.filter(p => p.id));
        labels.enter().append("text").attr("class", `label-${safeClass}`)
            .merge(labels)
            .attr("x", d => x(d.s) + 8).attr("y", d => y(d.T) - 8)
            .text(d => d.id).style("fill", color).style("font-family", "var(--font-mono)").style("font-size", "11px").style("opacity", 0.8);
        labels.exit().remove();
    };

    const getSat = (T_val) => satT.find(r => r[0] >= T_val) || satT[satT.length-1];
    
    const ptHighR = getSat(300); const ptLowR = getSat(50);
    drawReference([ { id: 'R1', s: ptHighR[7], T: 300 }, { id: 'R2', s: ptHighR[7], T: 50 }, { id: 'R3', s: ptLowR[6], T: 50 }, { id: 'R4', s: ptLowR[6], T: 55 }, { id: 'R4a', s: ptHighR[6], T: 300 }, { s: ptHighR[7], T: 300 } ], "#3b82f6", "rankine", "Rankine Ideal");

    const ptHighC = getSat(250); const ptLowC = getSat(100);
    drawReference([ { id: 'C1', s: ptHighC[7], T: 250 }, { id: 'C2', s: ptHighC[7], T: 100 }, { id: 'C3', s: ptHighC[6], T: 100 }, { id: 'C4', s: ptHighC[6], T: 250 }, { s: ptHighC[7], T: 250 } ], "#f59e0b", "carnot", "Carnot Ideal");

    const buildVisualPath = (t1, t2) => {
        const pPath = [
            { s: pontos[0].s, T: t1 },
            { s: pontos[0].s, T: t2 },
            { s: pontos[2].s, T: t2 },
            { s: pontos[3].s, T: pontos[3].T } 
        ];
        if (t1 > satAlta.T + 0.1) {
            pPath.push({ T: satAlta.T, s: satAlta.sf });
            pPath.push({ T: satAlta.T, s: satAlta.sg });
        } else if (t1 === satAlta.T) {
            pPath.push({ T: satAlta.T, s: satAlta.sf });
        }
        pPath.push({ s: pontos[0].s, T: t1 });
        return pPath;
    };

    const realCycleLine = d3.line().x(d => x(d.s)).y(d => y(d.T));

    g.select(".live-line")
      .datum(buildVisualPath(localT1Ref.current, localT2Ref.current))
      .style("fill", mainColor).style("fill-opacity", 0.15) 
      .attr("stroke", mainColor).attr("stroke-width", 2.5)
      .attr("d", realCycleLine);

    const visualPontos = [
        { ...pontos[0], T: localT1Ref.current, id: 1 }, 
        { ...pontos[1], s: pontos[0].s, T: localT2Ref.current, id: 2 }, 
        { ...pontos[2], T: localT2Ref.current, id: 3 },
        { ...pontos[3], id: 4 } 
    ];

    const nodes = g.select(".live-nodes").selectAll("circle").data(visualPontos);
    nodes.enter().append("circle")
      .merge(nodes)
      .attr("class", d => `live-node-${d.id}`)
      .attr("cx", d => x(d.s)).attr("cy", d => y(d.T)).attr("r", 6)
      .attr("fill", "var(--bg)").attr("stroke", mainColor).attr("stroke-width", 2.5)
      .style("cursor", d => [1,2,3].includes(d.id) ? "ns-resize" : "crosshair")
      .on("mouseover", function() { tooltip.style("opacity", 1); d3.select(this).attr("r", 9).attr("fill", mainColor); })
      .on("mousemove", function(event, d) {
          const prefix = [1,2,3].includes(d.id) ? "↕ Arraste " : "Ponto ";
          tooltip.html(`<strong style="color:${mainColor}">${prefix}${d.id}</strong><br/>T: ${d.T.toFixed(2)} °C<br/>s: ${d.s.toFixed(4)}`)
                 .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
      })
      .on("mouseleave", function() { tooltip.style("opacity", 0); d3.select(this).attr("r", 6).attr("fill", "var(--bg)"); });
    nodes.exit().remove();

    const labels = g.select(".live-labels").selectAll("text").data(visualPontos);
    labels.enter().append("text")
      .merge(labels)
      .attr("class", d => `live-label-${d.id}`)
      .attr("x", d => x(d.s) + (d.id === 2 || d.id === 3 ? -16 : 12)).attr("y", d => y(d.T) - 8)
      .text(d => d.id).style("fill", mainColor).style("font-family", "var(--font-mono)").style("font-weight", "bold").style("font-size", "14px");
    labels.exit().remove();

    const dragPonto1 = d3.drag()
        .on("start", function() { d3.select(this).style("cursor", "grabbing"); tooltip.style("opacity", 0); })
        .on("drag", function(event) {
            let newT = y.invert(event.y);
            if(newT < satAlta.T) newT = satAlta.T; 
            if(newT > 600) newT = 600; 

            localT1Ref.current = newT; 
            d3.select(this).attr("cy", y(newT));
            g.select(".live-label-1").attr("y", y(newT) - 8);
            g.select(".live-line").datum(buildVisualPath(newT, localT2Ref.current)).attr("d", realCycleLine);

            // AVISA A TABELA PARA SE MOVER JUNTO (Suavemente)
            if (onGraphDrag) onGraphDrag(newT, null);
        })
        .on("end", function() { 
            d3.select(this).style("cursor", "ns-resize"); 
            if (onGraphDrop) onGraphDrop(localT1Ref.current, null);
        });

    const dragLinhaBaixo = d3.drag()
        .on("start", function() { d3.select(this).style("cursor", "grabbing"); tooltip.style("opacity", 0); })
        .on("drag", function(event) {
            let newT = y.invert(event.y);
            if (newT < 0.1) newT = 0.1;
            if (newT > satAlta.T - 5) newT = satAlta.T - 5; 

            localT2Ref.current = newT; 
            g.select(".live-node-2").attr("cy", y(newT));
            g.select(".live-label-2").attr("y", y(newT) - 8);
            g.select(".live-node-3").attr("cy", y(newT));
            g.select(".live-label-3").attr("y", y(newT) - 8);
            
            g.select(".live-line").datum(buildVisualPath(localT1Ref.current, newT)).attr("d", realCycleLine);

            // AVISA O INPUT DE PRESSÃO INFERIOR PARA MUDAR
            if (onGraphDrag) onGraphDrag(null, newT);
        })
        .on("end", function() { 
            d3.select(this).style("cursor", "ns-resize"); 
            if (onGraphDrop) onGraphDrop(null, localT2Ref.current);
        });

    g.select(".live-node-1").call(dragPonto1);
    g.select(".live-node-2").call(dragLinhaBaixo);
    g.select(".live-node-3").call(dragLinhaBaixo);

  }, [pontos, domeData, satAlta, cycleColor, onGraphDrag, onGraphDrop]);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '15px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>Diagrama T-s Interativo</span>
      </div>
      <div style={{ width: '100%', height: '450px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
          <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '20px', height: '2px', borderBottom: '2px dashed #64748b' }}></span> Cúpula</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cycleColor || '#10b981' }}></span> Seu Ciclo Vivo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', opacity: 0.8 }}></span> Rankine Ideal</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', opacity: 0.8 }}></span> Carnot Ideal</div>
      </div>
    </div>
  );
}