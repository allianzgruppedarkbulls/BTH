// main.js - Event-Handling, Voreinstellung Parallelen & Nachträgliches Verbinden
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
let activeParallelCount = 1;

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

function setTool(tool) {
    State.currentTool = tool;
    polygonPoints = [];
    pipePoints = [];
    scaleStartPoint = null;
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

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (spacePressed || e.button === 1) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    // Rohrleitung zeichnen mit Einrastfunktion
    if (State.currentTool === 'draw-pipe') {
        const snap = getSnappedPoint(world.x, world.y, 20 / scale);
        const pt = { x: snap.x, y: snap.y };

        pipePoints.push(pt);

        if (pipePoints.length >= 2) {
            pushState();
            const multiPipes = generateParallelPipes(pipePoints, activeParallelCount, 25);
            State.objects.push(...multiPipes);
            State.selectedObj = multiPipes[0];
            
            // Punkt für nahtlose Weiterverlegung behalten
            pipePoints = [pt];
            updateSidebar(State.selectedObj);
        }
        draw();
        return;
    }

    // Bearbeiten / Punkte verschieben
    if (State.currentTool === 'select') {
        const handleRadius = 15 / scale;

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
                    if (distToSegment(world, o.points[i - 1], o.points[i]) < 12 / scale) {
                        foundObj = o;
                        break;
                    }
                }
            }
            if (foundObj) break;
        }

        State.selectedObj = foundObj;
        activeHandleIndex = -1;
        updateSidebar(State.selectedObj);
        draw();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    let world = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) {
        offsetX = (e.clientX - rect.left) - startPanX;
        offsetY = (e.clientY - rect.top) - startPanY;
        draw();
        return;
    }

    // Dragging mit automatischem Snap/Verbinden an andere Rohre
    if (activeHandleIndex !== -1 && State.selectedObj && State.selectedObj.points) {
        const snap = getSnappedPoint(world.x, world.y, 15 / scale);
        State.selectedObj.points[activeHandleIndex] = { x: snap.x, y: snap.y };
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

function distToSegment(p, v, w) {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

window.draw = function() {
    ctx.clearRect(0, 0, width, height);
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
    updateSidebar(null);
    window.draw();
};
