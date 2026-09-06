// pipes.js - Hydraulik, durchgehende Stränge & Fitting-Knotenpunkte (Anbohrschellen / Abzweige)
import { SYSTEM_CONFIG } from './config.js';
import { State } from './state.js';

export function createPipe(points, diameter = 25, label = 'Hauptstrang', color = null) {
    return {
        id: `pipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'pipe',
        label: label,
        points: [...points],          // Durchgehender Schlauch / Polyline
        nodesData: {},                // Bauteil-Daten pro Knoten: { index: { type: 'tapping_saddle', thread: '3/4', outlet: 16 } }
        diameter: Number(diameter),
        assignedZone: 'Sektor 1',
        flowRateLh: 1200,
        customColor: color,
        locked: false
    };
}

export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const config = SYSTEM_CONFIG.pipes.find(p => p.outerDiameter === Number(obj.diameter)) || {
        color: '#38bdf8',
        defaultWidth: 3
    };

    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : config.color);

    ctx.save();
    
    // 1. Durchgehender Strang (Ein einziges Element)
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = (isSelected ? config.defaultWidth + 2 : config.defaultWidth) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Gesamt-Längenlabel & Segmentmessung
    const pxm = State.pixelsPerMeter || 20;

    for (let i = 1; i < obj.points.length; i++) {
        const p1 = obj.points[i - 1];
        const p2 = obj.points[i];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        if (isSelected) {
            // Zwischenpunkt-Biegehandle
            ctx.beginPath();
            ctx.arc(midX, midY, 4 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#94a3b8';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 / scale;
            ctx.fill();
            ctx.stroke();
        }
    }

    // 3. Knotenpunkte & optische Bauteile (Anbohrschelle / T-Stücke / Ventile)
    if (!obj.nodesData) obj.nodesData = {};

    obj.points.forEach((p, index) => {
        const node = obj.nodesData[index];

        ctx.save();
        ctx.translate(p.x, p.y);

        if (node && node.type === 'tapping_saddle') {
            // Optische Darstellung: Anbohrschelle auf dem Schlauch
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2 / scale;
            
            // Schellen-Körper (Sattel)
            ctx.fillRect(-6 / scale, -6 / scale, 12 / scale, 12 / scale);
            ctx.strokeRect(-6 / scale, -6 / scale, 12 / scale, 12 / scale);

            // Gewinde-Abgang (z.B. 3/4" Stutzen)
            ctx.beginPath();
            ctx.arc(0, 0, 3 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();

            // Label im Modus
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${8 / scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`Schelle (${node.thread || '3/4"'})`, 0, -9 / scale);

        } else if (node && node.type === 'valve') {
            // Optische Darstellung: Ventil
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(0, 0, 7 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();

        } else {
            // Normaler Verbindungsknoten
            const isEnd = index === 0 || index === obj.points.length - 1;
            ctx.beginPath();
            ctx.arc(0, 0, (isEnd ? 6 : 4) / scale, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#f59e0b' : '#64748b';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 / scale;
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    });

    ctx.restore();
}

// Knoten-Eigenschaften über Sidebar oder Klick konfigurieren
export function setNodeComponent(pipeObj, nodeIndex, componentType, threadSize = '3/4', flexOutletMm = 16) {
    if (!pipeObj.nodesData) pipeObj.nodesData = {};

    if (componentType === 'none') {
        delete pipeObj.nodesData[nodeIndex];
    } else {
        pipeObj.nodesData[nodeIndex] = {
            type: componentType, // 'tapping_saddle', 'tee', 'valve'
            mainPipeDiameter: pipeObj.diameter,
            thread: threadSize,  // '1/2"', '3/4"'
            outletMm: flexOutletMm // z.B. 16mm Flexschlauch
        };
    }
    if (typeof draw === 'function') draw();
}

// Punkt aus dem durchgehenden Strang löschen (ohne Trennung)
export function removePointFromPipe(pipeObj, index) {
    if (pipeObj.points.length > 2) {
        pipeObj.points.splice(index, 1);
        if (pipeObj.nodesData && pipeObj.nodesData[index]) {
            delete pipeObj.nodesData[index];
        }
        if (typeof draw === 'function') draw();
    }
}

export function getPipeSidebarHTML(obj) {
    const hyd = calculateHydraulics(obj);
    const currentDiameter = Number(obj.diameter) || 25;
    const orderLength = Math.ceil(hyd.length * 1.10);

    // Zählen der verbauten Anbohrschellen
    let saddleCount = 0;
    if (obj.nodesData) {
        Object.values(obj.nodesData).forEach(n => {
            if (n.type === 'tapping_saddle') saddleCount++;
        });
    }

    return `
        <div style="padding: 15px; color: #fff; font-family: sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0; font-size:16px;">🛠️ ${obj.label || 'Durchgehender Strang'}</h3>
                <button onclick="deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
            </div>

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Rohr-Durchmesser (Hauptschlauch):</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="16" ${currentDiameter === 16 ? 'selected' : ''}>16 mm Flex/Tropfrohr</option>
                <option value="20" ${currentDiameter === 20 ? 'selected' : ''}>20 mm PE-Rohr</option>
                <option value="25" ${currentDiameter === 25 ? 'selected' : ''}>25 mm PE-Rohr</option>
                <option value="32" ${currentDiameter === 32 ? 'selected' : ''}>32 mm PE-Rohr</option>
            </select>

            <!-- Material & Stückliste -->
            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155; margin-bottom:15px;">
                <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:13px; border-bottom:1px solid #334155; padding-bottom:4px;">📦 Materialliste (Strang)</h4>
                
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Schlauch-Gesamtlänge:</span> <strong style="color:#fff;">${hyd.length} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#f59e0b;">Bestellmenge (+10%):</span> <strong style="color:#f59e0b;">${orderLength} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Verbaut Anbohrschellen:</span> <strong style="color:#38bdf8;">${saddleCount} Stk.</strong>
                </div>
            </div>

            <!-- Ausgewählter Knotenpunkt / Bauteil zuweisen -->
            <div style="border-top:1px solid #334155; padding-top:10px;">
                <h4 style="margin:0 0 8px 0; color:#e2e8f0; font-size:12px;">📍 Knotenpunkt-Bauteil setzen</h4>
                <p style="font-size:10px; color:#94a3b8; margin-bottom:8px;">Klicke auf einen Punkt des Rohrs, um Bauteile zu montieren:</p>
                
                <button onclick="attachSaddleToSelectedNode('tapping_saddle')" style="width:100%; padding:8px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; margin-bottom:6px;">
                    + Anbohrschelle (${currentDiameter}mm auf IG 3/4")
                </button>
                <button onclick="attachSaddleToSelectedNode('valve')" style="width:100%; padding:8px; background:#dc2626; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">
                    + Absperrventil einsetzen
                </button>
            </div>
        </div>`;
}

export function calculatePipeLength(points) {
    if (!points || points.length < 2) return 0;
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
        totalPx += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const pxm = State.pixelsPerMeter || 20;
    return Math.round((totalPx / pxm) * 100) / 100;
}

export function calculateHydraulics(pipe) {
    const lengthMeters = calculatePipeLength(pipe.points);
    return {
        length: lengthMeters,
        velocity: "1.2",
        pressureLoss: "0.15"
    };
}

export function updatePipeProp(prop, val) {
    const targetObj = State.selectedObj;
    if (targetObj && targetObj.type === 'pipe') {
        targetObj[prop] = prop === 'diameter' ? Number(val) : val;
        if (typeof draw === 'function') draw();
    }
}

if (typeof window !== 'undefined') {
    window.updatePipeProp = updatePipeProp;
    window.setNodeComponent = setNodeComponent;
    window.removePointFromPipe = removePointFromPipe;
}
