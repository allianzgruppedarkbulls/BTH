// js/main.js - Clean Modular Entry Point
import { State } from './state.js';

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// Canvas an Fenstergröße anpassen
function resize() {
    if (!container || !canvas) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    render();
}
window.addEventListener('resize', resize);

// Welt-Koordinaten Umrechnung
function toWorld(sX, sY) {
    return {
        x: (sX - State.offsetX) / State.scale,
        y: (sY - State.offsetY) / State.scale
    };
}

// Globaler Tool-Wechsler
window.setTool = function(toolName) {
    State.activeTool = toolName;
    State.selectedObj = null;
    console.log("Aktives Tool:", toolName);
    render();
};

// Haupt-Renderschleife
export function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Zoom & Verschiebung anwenden
    ctx.translate(State.offsetX, State.offsetY);
    ctx.scale(State.scale, State.scale);

    // 1. Hintergrundbild zeichnen
    if (State.bgImage) {
        ctx.drawImage(State.bgImage, 0, 0);
    }

    // 2. Alle Objekte zeichnen
    State.objects.forEach(obj => {
        // Hier binden wir später Schritt für Schritt die Renderer ein
    });

    ctx.restore();
}

// Zoom & Pan Handler
let isPanning = false, panStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.shiftKey) { // Mittlere Maustaste oder Shift+Klick = Pan
        isPanning = true;
        panStart = { x: e.clientX - State.offsetX, y: e.clientY - State.offsetY };
        return;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        State.offsetX = e.clientX - panStart.x;
        State.offsetY = e.clientY - panStart.y;
        render();
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

window.onload = () => {
    resize();
};
