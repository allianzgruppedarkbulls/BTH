// main.js - CAD Hauptsteuerung, Undo/Redo & Parallel-Stränge
import { State } from './state.js';
import { updateSidebar } from './sidebar.js';
import { drawLawn, calculatePolygonArea } from './lawn.js';
import { drawPipe, getSnappedPoint, generateParallelPipes } from './pipes.js';
import { drawSprinkler } from './sprinklers.js';
import { drawDripZone } from './drip-renderer.js';

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

let width = container.clientWidth;
let height = container.clientHeight;
canvas.width = width; 
canvas.height = height;

let scale = 1.0, offsetX = 0, offsetY = 0;
let isPanning = false, startPanX = 0, startPanY = 0, spacePressed = false;

let polygonPoints = [];
let pipePoints = [];
let currentMouseWorld = null;
let activeHandleIndex = -1;
let scaleStartPoint = null;

// Undo / Redo Speicher
const undoStack = [];
const redoStack = [];

function pushState() {
    undoStack.push(JSON.stringify(State.objects));
    if (undoStack.length > 30) undoStack.shift();
    redoStack.length = 0;
}

window.undo = function() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(State.objects));
        State.objects = JSON.parse(undoStack.pop());
        State.selectedObj = null;
        updateSidebar(null);
        draw();
    }
};

window.redo = function() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(State.objects));
        State.objects = JSON.parse(redoStack.pop());
        State.selectedObj = null;
        updateSidebar(null);
        draw();
    }
};

function toWorld(sX, sY) {
    return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale };
}

window.deselectCurrent = function() {
    State.selectedObj = null;
    activeHandleIndex = -1;
    updateSidebar(null);
    draw();
};

// Tastatur-Shortcuts für Undo / Redo / Abbrechen
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') spacePressed = true;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        window.undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        window.redo();
    }
    if (e.key === 'Escape') {
        pipePoints = [];
        polygonPoints = [];
        window.deselectCurrent();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spacePressed = false;
});

// Zoom per Mausrad
container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const mX = e.clientX - container.getBoundingClientRect().left;
    const mY = e.clientY - container.getBoundingClientRect().top;
    offsetX = mX - (mX - offsetX) * factor;
    offsetY = mY - (mY - offsetY) * factor;
    scale *= factor;
    const zoomEl = document.getElementById('val-zoom');
    if (zoomEl) zoomEl.innerText = `${Math.round(scale * 100)}%`;
    draw();
});

function setTool(tool) {
    State.currentTool = tool;
    polygonPoints = [];
    pipePoints = [];
    scaleStartPoint = null;
    activeHandleIndex = -1;
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${tool}`);
    if (btn) btn.classList.add('active');
    draw();
}

const bindBtn = (id, toolName) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => setTool(toolName);
};

bindBtn('btn-select', 'select');
bindBtn('btn-scale', 'scale');
bindBtn('btn-draw-lawn', 'draw-lawn');
bindBtn('btn-draw-drip', 'draw-drip');
bindBtn('btn-draw-deadzone', 'draw-deadzone');
bindBtn('btn-add-source', 'add-source');
bindBtn('btn-add-sprinkler', 'add-sprinkler');
bindBtn('btn-draw-pipe', 'draw-pipe');

const deleteBtn = document.getElementById('btn-delete');
if (deleteBtn) {
    deleteBtn.onclick = () => {
        if (State.selectedObj) {
            pushState();
            State.objects = State.objects.filter(o => o !== State.selectedObj);
            window.deselectCurrent();
        }
    };
}

// Maus-Klick auf Canvas
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; 
        startPanX = e.clientX - offsetX; 
        startPanY = e.clientY - offsetY;
        return;
    }

    // 1. Maßstab
    if (State.currentTool === 'scale') {
        if (!scaleStartPoint) {
            scaleStartPoint = world;
        } else {
            const distPx = Math.hypot(world.x - scaleStartPoint.x, world.y - scaleStartPoint.y);
            const inputMeters = prompt("Strecke in Metern:", "5");
            if (inputMeters && !isNaN(parseFloat(inputMeters)) && parseFloat(inputMeters) > 0) {
                State.pixelsPerMeter = distPx / parseFloat(inputMeters);
                const pxmEl = document.getElementById('val-px-m');
                if (pxmEl) pxmEl.innerText = `${State.pixelsPerMeter.toFixed(1)} px/m`;
            }
            scaleStartPoint = null;
            setTool('select');
        }
        draw();
        return;
    }

    // 2. Rohrleitung zeichnen (mit Live-Vorschau & Multistrang)
    if (State.currentTool === 'draw-pipe') {
        const snapped = getSnappedPoint(world.x, world.y, 15 / scale);
        const pt = { x: snapped.x, y: snapped.y };

        pipePoints.push(pt);

        if (pipePoints.length >= 2) {
            pushState();
            const parallelCount = parseInt(prompt("Wie viele parallele Leitungen sollen verlegt werden?", "1")) || 1;
            
            if (parallelCount > 1) {
                const multiPipes = generateParallelPipes(pipePoints, parallelCount, 12 / scale, 25);
                State.objects.push(...multiPipes);
                State.selectedObj = multiPipes[0];
            } else {
                const multiPipes = generateParallelPipes(pipePoints, 1, 0, 25);
                State.objects.push(multiPipes[0]);
                State.selectedObj = multiPipes[0];
            }

            pipePoints = [];
            updateSidebar(State.selectedObj);
            setTool('select');
        }
        draw();
        return;
    }

    // 3. Flächen zeichnen
    if (State.currentTool === 'draw-lawn' || State.currentTool === 'draw-drip' || State.currentTool === 'draw-deadzone') {
        const snapRadius = 15 / scale;
        if (polygonPoints.length > 2 && Math.hypot(world.x - polygonPoints[0].x, world.y - polygonPoints[0].y) < snapRadius) {
            finishPolygon();
            return;
        }
        polygonPoints.push(world);
        draw();
        return;
    }

    // 4. Auswahl & Verschieben
    if (State.currentTool === 'select') {
        const handleRadius = 12 / scale;

        if (State.selectedObj && State.selectedObj.points && !State.selectedObj.locked) {
            for (let i = 0; i < State.selectedObj.points.length; i++) {
                if (Math.hypot(world.x - State.selectedObj.points[i].x, world.y - State.selectedObj.points[i].y) < handleRadius) {
                    pushState();
                    activeHandleIndex = i;
                    return;
                }
            }
        }

        let foundObj = null;
        for (let o of State.objects.slice().reverse()) {
            if (o.type === 'pipe' && o.points) {
                for (let i = 1; i < o.points.length; i++) {
                    if (distToSegment(world, o.points[i - 1], o.points[i]) < 10 / scale) {
                        foundObj = o;
                        break;
                    }
                }
            }
            if (foundObj) break;
        }

        if (!foundObj) {
            foundObj = State.objects.slice().reverse().find(o => (o.type === 'source' || o.type === 'sprinkler') ? Math.hypot(world.x - o.x, world.y - o.y) < 15 / scale : false) ||
                       State.objects.slice().reverse().find(o => o.points && isPointInPolygon(world, o.points)) || null;
        }

        State.selectedObj = foundObj;
        activeHandleIndex = -1;
        updateSidebar(State.selectedObj);
        draw();
    }
});

function distToSegment(p, v, w) {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function finishPolygon() {
    if (polygonPoints.length > 2) {
        pushState();
        let type = 'lawn';
        if (State.currentTool === 'draw-drip') type = 'drip';
        if (State.currentTool === 'draw-deadzone') type = 'deadzone';

        const newObj = {
            type,
            points: [...polygonPoints],
            dripDistance: 33,
            layoutMode: 'loop',
            locked: false,
            areaM2: calculatePolygonArea(polygonPoints, State.pixelsPerMeter)
        };
        State.objects.push(newObj);
        State.selectedObj = newObj;
        polygonPoints = [];
        updateSidebar(State.selectedObj);
        setTool('select');
    }
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) {
        offsetX = (e.clientX - rect.left) - startPanX;
        offsetY = (e.clientY - rect.top) - startPanY;
        draw();
        return;
    }

    if (activeHandleIndex !== -1 && State.selectedObj && State.selectedObj.points && !State.selectedObj.locked) {
        State.selectedObj.points[activeHandleIndex] = world;
        updateSidebar(State.selectedObj);
        draw();
        return;
    }

    currentMouseWorld = world;
    draw();
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
    activeHandleIndex = -1;
});

// Haupt-Zeichenschleife mit Live-Vorschau
window.draw = function() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (State.backgroundImg) {
        ctx.drawImage(State.backgroundImg, 0, 0);
    }

    State.objects.forEach(obj => {
        const isSelected = (obj === State.selectedObj);
        if (obj.type === 'lawn' || obj.type === 'deadzone') {
            drawLawn(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'drip') {
            drawDripZone(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'sprinkler') {
            drawSprinkler(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        } else if (obj.type === 'pipe') {
            drawPipe(ctx, obj, scale, isSelected);
        }
    });

    // Live-Vorschau beim Rohre zeichnen (Gelbe Führungslinie)
    if (State.currentTool === 'draw-pipe' && pipePoints.length > 0 && currentMouseWorld) {
        ctx.beginPath();
        ctx.moveTo(pipePoints[0].x, pipePoints[0].y);
        ctx.lineTo(currentMouseWorld.x, currentMouseWorld.y);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([4 / scale, 4 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore();
};

window.onload = () => {
    updateSidebar(null);
    window.draw();
};
