// js/pipes.js - Hydraulik, echter Magnet-Snapping, Kreisschluss & aggregierte Schläuche
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
        valveZone: 'v1', // Standardzuordnung (v1, v2, v3, main)
        allowPointEdit: false
    };
}

/**
 * MAGNET-SNAPPING: Findet den nächsten Punkt aller bestehenden Rohre
 * und snappt beim Zeichnen/Verschieben exakt auf dessen Koordinaten.
 */
export function getSnappedPoint(cursorX, cursorY, scale = 1, snapRadiusPx = 25, ignoreObj = null) {
    let bestPoint = { x: cursorX, y: cursorY, isSnapped: false, targetObj: null };
    let minDist = snapRadiusPx / scale; 

    const allObjects = State.objects || [];
    for (const obj of allObjects) {
        if (obj.type === 'pipe' && obj.points && obj !== ignoreObj) {
            obj.points.forEach((p) => {
                const dist = Math.hypot(p.x - cursorX, p.y - cursorY);
                if (dist < minDist) {
                    minDist = dist;
                    // Exakter Treffer: Koordinaten eins zu eins übernehmen
                    bestPoint = { x: p.x, y: p.y, isSnapped: true, targetObj: obj };
                }
            });
        }
    }
    return bestPoint;
}

/**
 * Berechnet die Meter-Länge einer einzelnen Punkt-Kette
 */
export function calculatePipeLength(points) {
    if (!points || points.length < 2) return 0;
    let totalPx = 0;
    for (let i = 1; i < points.length; i++) {
        totalPx += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const pxm = State.pixelsPerMeter || 20;
    return Math.round((totalPx / pxm) * 100) / 100;
}

/**
 * KREISLAUF & VERBINDUNGSPRÜFUNG:
 * Fasst alle zusammenhängenden Rohre/Kreisläufe zu EINEM Bestell-Schlauch zusammen.
 */
export function getAggregatedPipelines() {
    const pipes = (State.objects || []).filter(o => o.type === 'pipe');
    const visited = new Set();
    const aggregated = [];

    pipes.forEach((pipe, index) => {
        if (visited.has(index)) return;

        let totalMeters = calculatePipeLength(pipe.points);
        let isClosedLoop = checkIsClosedLoop(pipe.points);
        visited.add(index);

        // Prüfen, ob andere Rohre an diesen Strang angeschlossen/angegliedert sind
        pipes.forEach((otherPipe, otherIndex) => {
            if (visited.has(otherIndex)) return;

            const isConnected = pipe.points.some(pt1 => 
                otherPipe.points.some(pt2 => Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y) < 1.0)
            );

            if (isConnected) {
                totalMeters += calculatePipeLength(otherPipe.points);
                if (checkIsClosedLoop(otherPipe.points)) isClosedLoop = true;
                visited.add(otherIndex);
            }
        });

        aggregated.push({
            id: pipe.id,
            label: pipe.label || `Schlauchkreis #${aggregated.length + 1}`,
            valveZone: pipe.valveZone || 'v1',
            diameter: pipe.diameter || 25,
            totalMeters: Math.ceil(totalMeters), // Aufgerundet auf ganze Meter für die Bestellung
            isClosedLoop: isClosedLoop,
            color: pipe.customColor
        });
    });

    return aggregated;
}

function checkIsClosedLoop(points) {
    if (!points || points.length < 3) return false;
    const start = points[0];
    const end = points[points.length - 1];
    return Math.hypot(start.x - end.x, start.y - end.y) < 1.0;
}

/**
 * Zeichnet Rohre, Verbindungs-Knoten und Ring-Meldungen
 */
export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const pxm = State.pixelsPerMeter || 20;
    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : '#38bdf8');
    const isLoop = checkIsClosedLoop(obj.points);

    ctx.save();
    
    // 1. Rohrtrasse zeichnen
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = (isSelected ? 5 : 3.5) / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Längen-Beschriftung an Segmenten
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

    // 3. Magnet-Knotenpunkte & Kreisschluss-Indikator
    obj.points.forEach((p, index) => {
        const isEnd = index === 0 || index === obj.points.length - 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isEnd ? 5.5 : 3.5) / scale, 0, Math.PI * 2);
        
        // Grüner Punkt bei geschlossenem Kreislauf / Treffer
        ctx.fillStyle = isLoop ? '#10b981' : ((isSelected && obj.allowPointEdit) ? '#ef4444' : drawColor);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / scale;
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * Generiert die verbesserte Sidebar ohne Stückwerk
 */
export function getPipeSidebarHTML(obj) {
    const aggregatedPipes = getAggregatedPipelines();
    const currentAgg = aggregatedPipes.find(a => a.id === obj.id) || { totalMeters: calculatePipeLength(obj.points), isClosedLoop: checkIsClosedLoop(obj.points) };

    return `
        <div style="padding: 15px; color: #fff; font-family: sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0; font-size:16px;">🛠️ ${obj.label || 'Rohrleitung'}</h3>
                <button onclick="window.deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
            </div>

            <!-- Status des Kreislaufs -->
            <div style="background:${currentAgg.isClosedLoop ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.15)'}; border:1px solid ${currentAgg.isClosedLoop ? '#10b981' : '#38bdf8'}; padding:8px; border-radius:6px; margin-bottom:12px; font-size:11px;">
                ${currentAgg.isClosedLoop 
                    ? '🔄 <strong>Geschlossener Ringkreis:</strong> Druckverlust optimiert!' 
                    : '📏 <strong>Offener Strang:</strong> Verbinde End- und Startpunkt für einen Ringkreis.'}
            </div>

            <!-- Zuordnung zu Ventilen -->
            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:3px;">Zuordnung / Ventilkreis:</label>
            <select onchange="window.updatePipeProp('valveZone', this.value)" style="width:100%; padding:6px; margin-bottom:12px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px; font-size:11px;">
                <option value="main" ${obj.valveZone === 'main' ? 'selected' : ''}>🔴 Vor Ventilbox (Zuleitung)</option>
                <option value="v1" ${obj.valveZone === 'v1' || !obj.valveZone ? 'selected' : ''}>🔵 Ventil 1 (Kreis 1)</option>
                <option value="v2" ${obj.valveZone === 'v2' ? 'selected' : ''}>🟢 Ventil 2 (Kreis 2)</option>
                <option value="v3" ${obj.valveZone === 'v3' ? 'selected' : ''}>🟡 Ventil 3 (Kreis 3)</option>
                <option value="v4" ${obj.valveZone === 'v4' ? 'selected' : ''}>🟣 Ventil 4 (Kreis 4)</option>
            </select>

            <!-- Kumulierte Schlauchlänge für Bestellung -->
            <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155; margin-bottom:15px;">
                <div style="font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#94a3b8;">Gesamt-Bestelllänge:</span> 
                    <strong style="color:#10b981; font-size:15px;">${currentAgg.totalMeters} m Schlauch</strong>
                </div>
            </div>

            <button onclick="window.togglePipeLock()" style="width:100%; padding:8px; background:${obj.allowPointEdit ? '#eab308' : '#3b82f6'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; margin-bottom:8px;">
                ${obj.allowPointEdit ? '🔒 Punkte fixieren' : '🔓 Punkte anpassen'}
            </button>
        </div>`;
}

// Globale Helper
window.togglePipeLock = () => {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        State.selectedObj.allowPointEdit = !State.selectedObj.allowPointEdit;
        if (typeof window.updateSidebar === 'function') window.updateSidebar(State.selectedObj);
        if (typeof window.draw === 'function') window.draw();
    }
};

window.updatePipeProp = (prop, val) => {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        State.selectedObj[prop] = val;
        if (typeof window.draw === 'function') window.draw();
    }
};
