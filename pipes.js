// pipes.js - Hydraulik, durchgehende Stränge, Parallel-Rohre & Anbohrschellen
import { SYSTEM_CONFIG } from './config.js';
import { State } from './state.js';

const PIPE_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#ef4444'];

export function createPipe(points, diameter = 25, label = 'Hauptstrang', color = null) {
    return {
        id: `pipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'pipe',
        label: label,
        points: JSON.parse(JSON.stringify(points)),
        nodesData: {},
        diameter: Number(diameter),
        assignedZone: 'Sektor 1',
        customColor: color || PIPE_COLORS[0],
        locked: false
    };
}

export function getSnappedPoint(cursorX, cursorY, snapRadius = 15) {
    let snapped = { x: cursorX, y: cursorY, isSnapped: false };
    const allObjects = State.objects || [];

    for (const obj of allObjects) {
        if (obj.points) {
            for (const p of obj.points) {
                const dist = Math.hypot(p.x - cursorX, p.y - cursorY);
                if (dist < snapRadius) {
                    return { x: p.x, y: p.y, isSnapped: true };
                }
            }
        }
    }
    return snapped;
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

export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const pxm = State.pixelsPerMeter || 20;
    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : '#38bdf8');

    ctx.save();
    
    // 1. Unteilbarer durchgehender Strang
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = (isSelected ? 5 : 3) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Segment-Bemaßung (Maße direkt an den Linien)
    for (let i = 1; i < obj.points.length; i++) {
        const p1 = obj.points[i - 1];
        const p2 = obj.points[i];
        const segDistPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const segMeters = (segDistPx / pxm).toFixed(2);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(midX - (16 / scale), midY - (7 / scale), 32 / scale, 14 / scale);
        
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${segMeters}m`, midX, midY);

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(midX, midY, 4 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#94a3b8';
            ctx.fill();
        }
    }

    // 3. Knotenpunkte & Anbohrschellen
    if (!obj.nodesData) obj.nodesData = {};

    obj.points.forEach((p, index) => {
        const node = obj.nodesData[index];

        ctx.save();
        ctx.translate(p.x, p.y);

        if (node && node.type === 'tapping_saddle') {
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2 / scale;
            
            ctx.fillRect(-6 / scale, -6 / scale, 12 / scale, 12 / scale);
            ctx.strokeRect(-6 / scale, -6 / scale, 12 / scale, 12 / scale);

            ctx.beginPath();
            ctx.arc(0, 0, 3 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();

            ctx.fillStyle = '#f59e0b';
            ctx.font = `bold ${9 / scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`Schelle ${obj.diameter}mm x ${node.thread || '3/4"'}`, 0, -10 / scale);

        } else {
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

export function generateParallelPipes(basePoints, count = 1, offsetPx = 15, diameter = 25) {
    const newPipes = [];
    for (let c = 0; c < count; c++) {
        const shift = (c - (count - 1) / 2) * offsetPx;
        const shiftedPoints = basePoints.map((p, idx) => {
            if (idx === 0) return { x: p.x, y: p.y + shift };
            const prev = basePoints[idx - 1];
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            return { x: p.x + nx * shift, y: p.y + ny * shift };
        });

        const pipe = createPipe(shiftedPoints, diameter, `Strang ${c + 1}`, PIPE_COLORS[c % PIPE_COLORS.length]);
        newPipes.push(pipe);
    }
    return newPipes;
}

export function setNodeComponent(pipeObj, nodeIndex, componentType, threadSize = '3/4"', flexOutletMm = 16) {
    if (!pipeObj.nodesData) pipeObj.nodesData = {};

    if (componentType === 'none') {
        delete pipeObj.nodesData[nodeIndex];
    } else {
        pipeObj.nodesData[nodeIndex] = {
            type: componentType,
            mainPipeDiameter: pipeObj.diameter,
            thread: threadSize,
            outletMm: flexOutletMm
        };
    }
    if (typeof window.draw === 'function') window.draw();
}

export function attachSaddleToNode(pipeObj, nodeIndex, thread = '3/4"', outlet = 16) {
    setNodeComponent(pipeObj, nodeIndex, 'tapping_saddle', thread, outlet);
}

export function getPipeSidebarHTML(obj) {
    const totalMeters = calculatePipeLength(obj.points);
    const orderLength = Math.ceil(totalMeters * 1.10);
    const currentDiameter = Number(obj.diameter) || 25;

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

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Rohr-Durchmesser:</label>
            <select id="pipe-diameter" onchange="updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="16" ${currentDiameter === 16 ? 'selected' : ''}>16 mm Flex/Tropfrohr</option>
                <option value="20" ${currentDiameter === 20 ? 'selected' : ''}>20 mm PE-Rohr</option>
                <option value="25" ${currentDiameter === 25 ? 'selected' : ''}>25 mm PE-Rohr</option>
                <option value="32" ${currentDiameter === 32 ? 'selected' : ''}>32 mm PE-Rohr</option>
            </select>

            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155; margin-bottom:15px;">
                <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:13px; border-bottom:1px solid #334155; padding-bottom:4px;">📦 Strang-Messung</h4>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Gesamtlänge:</span> <strong style="color:#fff;">${totalMeters} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#f59e0b;">Bestellmenge (+10%):</span> <strong style="color:#f59e0b;">${orderLength} m</strong>
                </div>
                <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">Verbaut Anbohrschellen:</span> <strong style="color:#38bdf8;">${saddleCount} Stk.</strong>
                </div>
            </div>

            <div style="border-top:1px solid #334155; padding-top:10px;">
                <h4 style="margin:0 0 8px 0; color:#e2e8f0; font-size:12px;">📍 Anbohrschelle setzen</h4>
                <p style="font-size:10px; color:#94a3b8; margin-bottom:8px;">Gewindeausgang wählen & am aktiven Endpunkt montieren:</p>
                
                <button onclick="attachSaddleToSelectedPipe('3/4\\"', 16)" style="width:100%; padding:8px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; margin-bottom:6px;">
                    + Schelle ${currentDiameter}mm x IG 3/4" (Abgang 16mm Flex)
                </button>
                <button onclick="attachSaddleToSelectedPipe('1/2\\"', 16)" style="width:100%; padding:8px; background:#0369a1; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">
                    + Schelle ${currentDiameter}mm x IG 1/2" (Abgang 16mm Flex)
                </button>
            </div>
        </div>`;
}

export function updatePipeProp(prop, val) {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        State.selectedObj[prop] = prop === 'diameter' ? Number(val) : val;
        if (typeof window.draw === 'function') window.draw();
    }
}

if (typeof window !== 'undefined') {
    window.updatePipeProp = updatePipeProp;
    window.attachSaddleToSelectedPipe = (thread, flexOutlet) => {
        if (State.selectedObj && State.selectedObj.type === 'pipe') {
            const lastIdx = State.selectedObj.points.length - 1;
            setNodeComponent(State.selectedObj, lastIdx, 'tapping_saddle', thread, flexOutlet);
        }
    };
}
