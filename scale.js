// js/scale.js - Bild-Upload und Maßstabskalibrierung
import { State } from './state.js';
import { render } from './main.js';

let scalePoints = [];

/**
 * Handhabt den Bild-Upload & passt das Bild an den Canvas an
 */
export function handleImageUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            State.bgImage = img;

            // --- NEU: Bild automatisch zentrieren & auf Canvas einpassen ---
            const canvas = document.getElementById('mainCanvas');
            if (canvas) {
                const scaleX = canvas.width / img.width;
                const scaleY = canvas.height / img.height;
                State.scale = Math.min(scaleX, scaleY) * 0.9; // 90% des Canvas füllen

                State.offsetX = (canvas.width - img.width * State.scale) / 2;
                State.offsetY = (canvas.height - img.height * State.scale) / 2;
            }

            // Stufe 2 UI freischalten (Maßstab-Button aktivieren)
            if (window.updateStepUI) window.updateStepUI(2);

            render();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Verarbeitet Klicks beim Ziehen der Maßstabslinie
 */
export function handleScaleClick(worldPt) {
    scalePoints.push(worldPt);

    if (scalePoints.length === 2) {
        const p1 = scalePoints[0];
        const p2 = scalePoints[1];
        const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const inputMeters = prompt("Wie lang ist diese Strecke in Metern?", "10.0");
        const meters = parseFloat(inputMeters);

        if (!isNaN(meters) && meters > 0) {
            State.pixelsPerMeter = distPx / meters;
            console.log(`Neuer Maßstab: ${State.pixelsPerMeter.toFixed(2)} px/m`);
            alert(`Maßstab erfolgreich gesetzt: ${State.pixelsPerMeter.toFixed(2)} Pixel = 1 Meter`);
            
            // Stufe 3 UI freischalten (Rasen & weitere Tools freischalten)
            if (window.updateStepUI) window.updateStepUI(3);
        }

        scalePoints = [];
        State.activeTool = 'select';
        render();
    }
}

/**
 * Zeichnet die temporäre Maßstabslinie während des Kalibrierens
 */
export function drawScaleTool(ctx, currentWorldPt) {
    if (scalePoints.length === 1 && currentWorldPt) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(scalePoints[0].x, scalePoints[0].y);
        ctx.lineTo(currentWorldPt.x, currentWorldPt.y);
        ctx.strokeStyle = '#ef4444'; // Rot
        ctx.lineWidth = 3 / State.scale;
        ctx.setLineDash([6 / State.scale, 4 / State.scale]);
        ctx.stroke();

        // Startpunkt-Marker
        ctx.beginPath();
        ctx.arc(scalePoints[0].x, scalePoints[0].y, 6 / State.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.restore();
    }
}
