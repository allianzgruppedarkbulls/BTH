// js/pipes.js - Vollständiges Pipe-System mit stabiler Abzweigung
import { State } from './state.js';


export function drawPipe(ctx, pipe) {
    if (!pipe.points || pipe.points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pipe.points[0].x, pipe.points[0].y);

    for (let i = 1; i < pipe.points.length; i++) {
        ctx.lineTo(pipe.points[i].x, pipe.points[i].y);
    }

    const isSelected = (State.selectedObj === pipe);
    
    // Priorität: Eigene Custom-Farbe > Zonen-Farbe > Standard Blau
    ctx.strokeStyle = isSelected ? '#38bdf8' : (pipe.color || getZoneColor(pipe.valveZone));
    ctx.lineWidth = isSelected ? 5 : (pipe.diameter ? Math.max(2, pipe.diameter / 8) : 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Punkte hervorheben, wenn selektiert oder im Bearbeitungsmodus
    if (isSelected || pipe.allowPointEdit) {
        pipe.points.forEach((pt, idx) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isSelected ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = idx === 0 ? '#10b981' : (idx === pipe.points.length - 1 ? '#ef4444' : '#f59e0b');
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    ctx.restore();
}

/**
 * Liefert die Farbe basierend auf der Ventilzone
 */
export function getZoneColor(zone) {
    const colors = {
        'main': '#ef4444', // Rot (Vor Ventilbox / Hauptleitung)
        'v1': '#3b82f6',   // Blau (Ventil 1)
        'v2': '#10b981',   // Grün (Ventil 2)
        'v3': '#f59e0b',   // Gelb (Ventil 3)
        'v4': '#8b5cf6'    // Violett (Ventil 4)
    };
    return colors[zone] || '#3b82f6';
}

/**
 * Berechnet die einzelnen Teilsegmente eines Strangs in Metern (Punkt zu Punkt)
 */
export function getPipeSegments(points) {
    if (!points || points.length < 2) return [];
    const scale = State.scale || 0.05; // Pixel zu Meter Umrechnung
    const segments = [];

    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i+1].x - points[i].x;
        const dy = points[i+1].y - points[i].y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        segments.push(parseFloat((distPx * scale).toFixed(2)));
    }
    return segments;
}

/**
 * Berechnet die Gesamtlänge einer Pipe in Metern
 */
export function calculatePipeLength(points) {
    const segments = getPipeSegments(points);
    return parseFloat(segments.reduce((a, b) => a + b, 0).toFixed(2));
}

/**
 * Prüft, ob ein Klick in der Nähe einer Pipe war (für Selektion)
 */
export function isPointNearPipe(pt, pipe, maxDist = 10) {
    if (!pipe.points || pipe.points.length < 2) return false;

    for (let i = 0; i < pipe.points.length - 1; i++) {
        const p1 = pipe.points[i];
        const p2 = pipe.points[i + 1];
        const dist = distToSegment(pt, p1, p2);
        if (dist <= maxDist) return true;
    }
    return false;
}

/**
 * Hilfsfunktion: Abstand Punkt zu Liniensegment
 */
function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Erstellt ein neues, sauberes Pipe-Objekt
 */
export function createPipe(startPoint, zone = 'v1', diameter = 25) {
    return {
        id: 'pipe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'pipe',
        label: '',
        valveZone: zone,
        color: getZoneColor(zone),
        diameter: diameter,
        points: [startPoint],
        allowPointEdit: false
    };
}

/**
 * Binds/Snaps einen Punkt an eine bestehende Pipe (für Abzweigungen)
 * ohne die Ursprungs-Pipe zu überschreiben.
 */
export function getSnapPointOnPipes(clickPt, existingPipes, snapRadius = 12) {
    let bestSnap = null;
    let minDistance = snapRadius;

    existingPipes.forEach(pipe => {
        if (!pipe.points) return;
        
        // 1. Prüfe Snap auf bestehende Punkte (T-Stück / Ecken)
        pipe.points.forEach(pt => {
            const d = Math.hypot(clickPt.x - pt.x, clickPt.y - pt.y);
            if (d < minDistance) {
                minDistance = d;
                bestSnap = { x: pt.x, y: pt.y, snappedToPoint: true, targetPipe: pipe };
            }
        });

        // 2. Prüfe Snap auf die Linie (Abzweig mitten auf der Strecke)
        if (!bestSnap) {
            for (let i = 0; i < pipe.points.length - 1; i++) {
                const p1 = pipe.points[i];
                const p2 = pipe.points[i + 1];
                const d = distToSegment(clickPt, p1, p2);
                if (d < minDistance) {
                    minDistance = d;
                    // Projiziere Punkt exakt auf die Linie
                    const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
                    let t = ((clickPt.x - p1.x) * (p2.x - p1.x) + (clickPt.y - p1.y) * (p2.y - p1.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    bestSnap = {
                        x: p1.x + t * (p2.x - p1.x),
                        y: p1.y + t * (p2.y - p1.y),
                        snappedToSegment: true,
                        targetPipe: pipe
                    };
                }
            }
        }
    });

    return bestSnap || clickPt;
}

/**
 * Generiert eine parallele Versatz-Leitung (Parallel-Offset)
 */
export function generateParallelPipes(originalPipe, offsetMeters = 0.3) {
    if (!originalPipe || !originalPipe.points || originalPipe.points.length < 2) return null;
    
    // Pixel-Abstand berechnen (Standard 0.3m Versatz)
    const scale = (State && State.scale) ? State.scale : 20.0;
    const offsetPx = offsetMeters * scale; 

    const newPoints = originalPipe.points.map((pt, i, arr) => {
        if (i === 0) {
            const next = arr[1];
            const dx = next.x - pt.x;
            const dy = next.y - pt.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: pt.x - (dy / len) * offsetPx, y: pt.y + (dx / len) * offsetPx };
        }
        const prev = arr[i - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: pt.x - (dy / len) * offsetPx, y: pt.y + (dx / len) * offsetPx };
    });

    return {
        id: 'pipe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'pipe',
        label: (originalPipe.label || 'Rohr') + ' (Parallel)',
        valveZone: originalPipe.valveZone || 'v1',
        color: originalPipe.color || '#3b82f6',
        diameter: originalPipe.diameter || 25,
        points: newPoints,
        allowPointEdit: false
    };
}
