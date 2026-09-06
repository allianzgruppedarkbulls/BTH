// js/pipes.js - Hydraulik, robuster Magnet-Snapper & Parallel-Pipeline-Generierung
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
        valveZone: 'v1',
        allowPointEdit: false
    };
}

/**
 * MAGNET-SNAPPING (Absolut absturzsicher)
 */
export function getSnappedPoint(cursorX, cursorY, scale = 1, snapRadiusPx = 25, ignoreObj = null) {
    let bestPoint = { x: cursorX, y: cursorY, isSnapped: false };
    let minDist = snapRadiusPx / Math.max(scale, 0.1);

    const allObjects = State.objects || [];
    for (const obj of allObjects) {
        if (obj.type === 'pipe' && Array.isArray(obj.points) && obj !== ignoreObj) {
            for (const p of obj.points) {
                const dist = Math.hypot(p.x - cursorX, p.y - cursorY);
                if (dist < minDist) {
                    minDist = dist;
                    bestPoint = { x: p.x, y: p.y, isSnapped: true };
                }
            }
        }
    }
    return bestPoint;
}

/**
 * Generiert parallele Rohrstränge
 */
export function generateParallelPipes(basePoints, count = 1, offsetPx = 25) {
    const resultPipes = [];
    if (!basePoints || basePoints.length < 2) return resultPipes;

    for (let i = 0; i < count; i++) {
        const pipePoints = basePoints.map(p => ({ x: p.x + (i * offsetPx), y: p.y + (i * offsetPx) }));
        const newPipe = createPipe(pipePoints, 25, count > 1 ? `Parallel-Strang #${i + 1}` : 'Hauptstrang', PIPE_COLORS[i % PIPE_COLORS.length]);
        resultPipes.push(newPipe);
    }
    return resultPipes;
}

/**
 * Berechnet die Meter-Länge
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

export function checkIsClosedLoop(points) {
    if (!points || points.length < 3) return false;
    const start = points[0];
    const end = points[points.length - 1];
    return Math.hypot(start.x - end.x, start.y - end.y) < 1.0;
}

/**
 * Zeichnet das Rohr auf dem Canvas
 */
export function drawPipe(ctx, obj, scale, isSelected) {
    if (!obj.points || obj.points.length < 2) return;

    const pxm = State.pixelsPerMeter || 20;
    const drawColor = obj.customColor || (isSelected ? '#f59e0b' : '#38bdf8');
    const isLoop = checkIsClosedLoop(obj.points);

    ctx.save();
    
    // 1. Rohrtrasse
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

    // 2. Segment-Längen
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

    // 3. Knotenpunkte
    obj.points.forEach((p, index) => {
        const isEnd = index === 0 || index === obj.points.length - 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isEnd ? 5.5 : 3.5) / scale, 0, Math.PI * 2);
        
        ctx.fillStyle = isLoop ? '#10b981' : ((isSelected && obj.allowPointEdit) ? '#ef4444' : drawColor);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / scale;
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
}
