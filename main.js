// main.js - Wiederhergestellte Kernfunktionalität & Event-Loop
import { State } from './state.js';
import { updateSidebar } from './sidebar.js';
import { drawLawn } from './lawn.js';
import { drawPipe, getSnappedPoint, generateParallelPipes } from './pipes.js';
import { drawSprinkler } from './sprinklers.js';
import { drawDripZone } from './drip-renderer.js';

window.updateSidebar = updateSidebar;

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

function resizeCanvas() {
    if (!container || !canvas) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);

let scale = 1.0, offsetX = 0, offsetY = 0;
let isPanning = false, startPanX = 0, startPanY = 0, spacePressed = false;

let pipePoints = [];
let currentMouseWorld = null;
let activeHandleIndex = -1;
let activeParallelCount = 1;

function toWorld(sX, sY) {
    return { x: (sX - offsetX) / scale, y: (sY - offsetY) / scale };
}

window.deselectCurrent = function() {
    if (State.selectedObj && State.selectedObj.type === 'pipe') {
        delete State.selectedObj.isDrawing;
    }
    State.selectedObj = null;
    activeHandleIndex = -1;
    pipePoints = [];
    updateSidebar(null);
    draw();
};

// Zoom über Mausrad
if (container) {
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        offsetX = mouseX - (mouseX - offsetX) * zoomFactor;
        offsetY = mouseY - (mouseY - offsetY) * zoomFactor;
        scale *= zoomFactor;

        const zoomEl = document.getElementById('val-zoom');
        if (zoomEl) zoomEl.innerText = `${Math.round(scale * 100)}%`;
        draw();
    }, { passive: false });
}

function setTool(tool) {
    State.currentTool = tool;
    pipePoints = [];
    activeHandleIndex = -1;

    if (tool === 'draw-pipe') {
        const input = prompt("Wie viele Rohrleitungen möchtest du parallel verlegen?", activeParallelCount.toString());
        if (input !== null && !isNaN(parseInt(input)) && parseInt(input) > 0) {
            activeParallelCount = parseInt(input);
        }
    }

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

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') spacePressed = true;
    if (e.key === 'Escape') { 
        window.deselectCurrent(); 
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spacePressed = false;
});

// ==========================================
// 1. Klicks auf dem Canvas (mousedown)
// ==========================================
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

    // --- ROHRLEITUNG ZEICHNEN ---
    if (State.currentTool === 'draw-pipe') {
        const snap = getSnappedPoint(world.x, world.y, scale, 20);
        const pt = { x: snap.x, y: snap.y };

        pipePoints.push(pt);

        if (pipePoints.length === 2) {
            const multiPipes = generateParallelPipes(pipePoints, activeParallelCount, 25);
            if (multiPipes.length > 0) {
                multiPipes[0].isDrawing = true;
                State.objects.push(...multiPipes);
                State.selectedObj = multiPipes[0];
            }
        } else if (pipePoints.length > 2 && State.selectedObj && State.selectedObj.type === 'pipe') {
            State.selectedObj.points.push(pt);
        }

        updateSidebar(State.selectedObj);
        draw();
        return;
    }

    // --- SELEKTION & KNOTEN BEWEGEN ---
    if (State.currentTool === 'select') {
        const handleRadius = 15 / scale;

        if (State.selectedObj && State.selectedObj.type === 'pipe' && State.selectedObj.allowPointEdit) {
            for (let i = 0; i < State.selectedObj.points.length; i++) {
                if (Math.hypot(world.x - State.selectedObj.points[i].x, world.y - State.selectedObj.points[i].y) < handleRadius) {
                    activeHandleIndex = i;
                    return;
                }
            }
        }

        let foundObj = null;
        for (let o of State.objects.slice().reverse()) {
            if (o.type === 'pipe' && o.points) {
                for (let i = 1; i < o.points.length; i++) {
                    if (distToSegment(world, o.points[i - 1], o.points[i]) < 12 / scale) {
                        foundObj = o;
                        break;
                    }
                }
            }
            if (foundObj) break;
        }

        if (State.selectedObj && State.selectedObj.type === 'pipe') {
            delete State.selectedObj.isDrawing;
        }

        State.selectedObj = foundObj;
        activeHandleIndex = -1;
        updateSidebar(State.selectedObj);
        draw();
    }
});

// ==========================================
// 2. Mausbewegung (mousemove) & Mouseup
// ==========================================
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) {
        offsetX = (e.clientX - rect.left) - startPanX;
        offsetY = (e.clientY - rect.top) - startPanY;
        draw();
        return;
    }

    if (activeHandleIndex !== -1 && State.selectedObj && State.selectedObj.points && State.selectedObj.allowPointEdit) {
        const snap = getSnappedPoint(world.x, world.y, scale, 20, State.selectedObj);
        State.selectedObj.points[activeHandleIndex] = { x: snap.x, y: snap.y };
        updateSidebar(State.selectedObj);
        draw();
        return;
    }

    if (State.currentTool === 'draw-pipe' && pipePoints.length > 0) {
        const snap = getSnappedPoint(world.x, world.y, scale, 20);
        currentMouseWorld = { x: snap.x, y: snap.y };
    } else {
        currentMouseWorld = world;
    }

    draw();
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
    activeHandleIndex = -1;
});

function distToSegment(p, v, w) {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// ==========================================
// 3. Render-Loop
// ==========================================
window.draw = function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (State.backgroundImg) ctx.drawImage(State.backgroundImg, 0, 0);

    State.objects.forEach(obj => {
        const isSelected = (obj === State.selectedObj);
        if (obj.type === 'lawn' || obj.type === 'deadzone') drawLawn(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        else if (obj.type === 'drip') drawDripZone(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        else if (obj.type === 'sprinkler') drawSprinkler(ctx, obj, scale, State.pixelsPerMeter, isSelected);
        else if (obj.type === 'pipe') drawPipe(ctx, obj, scale, isSelected);
    });

    if (State.currentTool === 'draw-pipe' && pipePoints.length > 0 && currentMouseWorld) {
        ctx.beginPath();
        ctx.moveTo(pipePoints[pipePoints.length - 1].x, pipePoints[pipePoints.length - 1].y);
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
    resizeCanvas();
    updateSidebar(null);
    window.draw();
};
