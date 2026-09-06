// js/main.js - Clean Modular Entry Point (mit Phase 1 Integration)
import { State } from './state.js';
import { handleImageUpload, handleScaleClick, drawScaleTool } from './scale.js';

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

let currentMouseWorld = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

function resize() {
    if (!container || !canvas) return;
    canvas.width = container.clientWidth || window.innerWidth;
    canvas.height = container.clientHeight || window.innerHeight;
    render();
}
window.addEventListener('resize', resize);

function toWorld(sX, sY) {
    return {
        x: (sX - State.offsetX) / State.scale,
        y: (sY - State.offsetY) / State.scale
    };
}

window.setTool = function(toolName) {
    State.activeTool = toolName;
    State.selectedObj = null;
    render();
};

// Haupt-Renderschleife
export function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    ctx.translate(State.offsetX, State.offsetY);
    ctx.scale(State.scale, State.scale);

    // 1. Hintergrundbild zeichnen
    if (State.bgImage) {
        ctx.drawImage(State.bgImage, 0, 0);
    }

    // 2. Maßstabs-Werkzeug zeichnen (falls aktiv)
    if (State.activeTool === 'scale') {
        drawScaleTool(ctx, currentMouseWorld);
    }

    ctx.restore();
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    
    // Pan mit mittlerer Maustaste oder Shift
    if (e.button === 1 || e.shiftKey) {
        isPanning = true;
        panStart = { x: e.clientX - State.offsetX, y: e.clientY - State.offsetY };
        return;
    }

    // Normaler Klick für Werkzeuge
    const worldPt = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (State.activeTool === 'scale') {
        handleScaleClick(worldPt);
    }
});
// Canvas Mausbewegung
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    currentMouseWorld = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (isPanning) {
        State.offsetX = e.clientX - panStart.x;
        State.offsetY = e.clientY - panStart.y;
    }
    
    render();
});

// Zoom & Pan
let isPanning = false, panStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.shiftKey) {
        isPanning = true;
        panStart = { x: e.clientX - State.offsetX, y: e.clientY - State.offsetY };
    }
});

canvas.addEventListener('mouseup', () => { isPanning = false; });

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    State.offsetX = mouseX - (mouseX - State.offsetX) * zoomFactor;
    State.offsetY = mouseY - (mouseY - State.offsetY) * zoomFactor;
    State.scale *= zoomFactor;
    render();
}, { passive: false });

// File-Upload Event Listener automatisch verdrahten
document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'file') {
        handleImageUpload(e.target.files[0]);
    }
});

window.onload = () => {
    resize();
};
