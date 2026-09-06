// pipes.js - Hydraulik, geschützte Strang-Integrität & stabile Sidebar
import { State } from './state.js';

const PIPE_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#ef4444'];

export function createPipe(points, diameter = 25, label = 'Hauptstrang', color = null) {
    return {
        id: `pipe_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'pipe',
        label: label,
        points: JSON.parse(JSON.stringify(points)),
        diameter: Number(diameter),
        customColor: color || PIPE_COLORS[0],
        allowPointEdit: false // Standardmäßig fixiert/gekoppelt
    };
}

export function getSnappedPoint(cursorX, cursorY, scale = 1, snapRadiusPx = 20) {
    let bestPoint = { x: cursorX, y: cursorY, isSnapped: false };
    // Wandelt den Pixel-Radius dynamisch anhand des aktuellen Zooms um
    let minDist = snapRadiusPx / scale; 

    const allObjects = State.objects || [];
    for (const obj of allObjects) {
        if (obj.type === 'pipe' && obj.points) {
            obj.points.forEach((p) => {
                const dist = Math.hypot(p.x - cursorX, p.y - cursorY);
                if (dist < minDist) {
                    minDist = dist;
                    bestPoint = { x: p.x, y: p.y, isSnapped: true };
                }
            });
        }
    }
    return bestPoint;
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
    
    // Durchgehende Linie
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

    // Längen an den Segmenten anzeigen
    for (let i = 1; i < obj.points.length; i++) {
        const p1 = obj.points[i - 1];
        const p2 = obj.points[i];
        const segDistPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const segMeters = (segDistPx / pxm).toFixed(2);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(midX - (18 / scale), midY - (8 / scale), 36 / scale, 16 / scale);
        
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${segMeters}m`, midX, midY);
    }

    // Knotenpunkte
    obj.points.forEach((p, index) => {
        const isEnd = index === 0 || index === obj.points.length - 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isEnd ? 5 : 3.5) / scale, 0, Math.PI * 2);
        ctx.fillStyle = (isSelected && obj.allowPointEdit) ? '#ef4444' : (isSelected ? '#f59e0b' : drawColor);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / scale;
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
}

export function generateParallelPipes(basePoints, count = 1, diameter = 25) {
    const pxm = State.pixelsPerMeter || 20;
    const offsetPx = 0.10 * pxm; // 10 cm Abstand
    const newPipes = [];

    for (let c = 0; c < count; c++) {
        const shift = (c - (count - 1) / 2) * offsetPx;
        const shiftedPoints = basePoints.map((p, idx) => {
            if (idx === 0 && basePoints.length > 1) {
                const next = basePoints[1];
                const dx = next.x - p.x; const dy = next.y - p.y;
                const len = Math.hypot(dx, dy) || 1;
                return { x: p.x + (-dy / len) * shift, y: p.y + (dx / len) * shift };
            }
            const prev = basePoints[idx - 1];
            const dx = p.x - prev.x; const dy = p.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: p.x + (-dy / len) * shift, y: p.y + (dx / len) * shift };
        });

        const pipe = createPipe(shiftedPoints, diameter, `Strang ${c + 1}`, PIPE_COLORS[c % PIPE_COLORS.length]);
        newPipes.push(pipe);
    }
    return newPipes;
}

export function getPipeSidebarHTML(obj) {
    const totalMeters = calculatePipeLength(obj.points);
    const pxm = State.pixelsPerMeter || 20;

    let segmentListHTML = '';
    for (let i = 1; i < obj.points.length; i++) {
        const dist = Math.hypot(obj.points[i].x - obj.points[i-1].x, obj.points[i].y - obj.points[i-1].y);
        const meters = (dist / pxm).toFixed(2);
        segmentListHTML += `
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#cbd5e1; margin-bottom:3px;">
                <span>Abschnitt ${i}:</span>
                <strong>${meters} m</strong>
            </div>`;
    }

    const isEditMode = obj.allowPointEdit || false;

    return `
        <div style="padding: 15px; color: #fff; font-family: sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0; font-size:16px;">🛠️ ${obj.label || 'Rohrleitung'}</h3>
                <button onclick="window.deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
            </div>

            <!-- Steuerungs-Buttons -->
            <div style="margin-bottom:12px; display:flex; flex-direction:column; gap:8px;">
                <button onclick="window.togglePipeLock()" style="width:100%; padding:8px; background:${isEditMode ? '#eab308' : '#3b82f6'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">
                    ${isEditMode ? '🔒 Strang fixieren (Schutz an)' : '🔓 Punkte frei verschieben'}
                </button>
                <button onclick="window.splitSelectedPipe()" style="width:100%; padding:8px; background:#dc2626; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">
                    ✂️ Strang entkoppeln / trennen
                </button>
            </div>

            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155; margin-bottom:15px;">
                <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:13px; border-bottom:1px solid #334155; padding-bottom:4px;">📐 Längenmessung</h4>
                <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#94a3b8;">Gesamtlänge:</span> 
                    <strong style="color:#10b981; font-size:14px;">${totalMeters} m</strong>
                </div>
                <div style="border-top:1px dashed #334155; padding-top:6px;">
                    ${segmentListHTML}
                </div>
            </div>

            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:2px;">Durchmesser:</label>
            <select id="pipe-diameter" onchange="window.updatePipeProp('diameter', this.value)" style="width:100%; padding:6px; margin-bottom:10px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                <option value="16" ${obj.diameter === 16 ? 'selected' : ''}>16 mm Flexrohr</option>
                <option value="25" ${obj.diameter === 25 ? 'selected' : ''}>25 mm PE-Rohr</option>
                <option value="32" ${obj.diameter === 32 ? 'selected' : ''}>32 mm PE-Rohr</option>
            </select>
        </div>`;
}

// Globale Fenster-Funktionen für Seitenleisten-Aktionen
window.togglePipeLock = () => {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        State.selectedObj.allowPointEdit = !State.selectedObj.allowPointEdit;
        if (typeof window.updateSidebar === 'function') window.updateSidebar(State.selectedObj);
        if (typeof window.draw === 'function') window.draw();
    }
};

window.splitSelectedPipe = () => {
    if (State.selectedObj && State.selectedObj.type === 'pipe' && State.selectedObj.points.length > 2) {
        const pipe = State.selectedObj;
        const mid = Math.floor(pipe.points.length / 2);
        
        const points1 = pipe.points.slice(0, mid + 1);
        const points2 = pipe.points.slice(mid);

        const pipe1 = createPipe(points1, pipe.diameter, `${pipe.label} (Teil 1)`, pipe.customColor);
        const pipe2 = createPipe(points2, pipe.diameter, `${pipe.label} (Teil 2)`, pipe.customColor);

        State.objects = State.objects.filter(o => o !== pipe);
        State.objects.push(pipe1, pipe2);
        State.selectedObj = pipe1;

        if (typeof window.updateSidebar === 'function') window.updateSidebar(State.selectedObj);
        if (typeof window.draw === 'function') window.draw();
    } else {
        alert("Der Strang hat zu wenige Punkte zum Trennen.");
    }
};

window.updatePipeProp = (prop, val) => {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        State.selectedObj[prop] = prop === 'diameter' ? Number(val) : val;
        if (typeof window.draw === 'function') window.draw();
    }
};
