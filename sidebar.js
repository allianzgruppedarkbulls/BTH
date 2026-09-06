// js/sidebar.js - Professionelle Ventilzonen-, Leitungs- und Arbeitszettel-Verwaltung
import { State } from './state.js';
import { calculatePipeLength } from './pipes.js';

export function updateSidebar(obj) {
    let sidebar = document.getElementById('sidebar-content') || document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;
    let targetContainer = sidebar.id === 'sidebar-content' ? sidebar : (sidebar.querySelector('#sidebar-content') || sidebar);

    // Filter und Zuordnungen
    const pipes = State.objects.filter(o => o.type === 'pipe');
    const sprinklers = State.objects.filter(o => o.type === 'sprinkler');
    const dripZones = State.objects.filter(o => o.type === 'drip');
    const lawns = State.objects.filter(o => o.type === 'lawn');

    // Dynamische Liste aller Elemente für das Hauptfenster
    let allElementsHTML = '';
    let totalWaterWeekly = 0;

    State.objects.forEach((o, index) => {
        let icon = '📦';
        let name = o.label || o.name || 'Element';
        let detail = '';

        if (o.type === 'lawn') {
            icon = '🟩'; name = 'Rasen'; detail = `${o.areaM2 || 0} m²`;
            totalWaterWeekly += Math.round((o.areaM2 || 0) * (o.waterRate || 25));
        } else if (o.type === 'drip') {
            icon = '💧'; name = 'Tropfzone'; detail = `${o.calculatedMeters || 0} m Schlauch`;
            totalWaterWeekly += Math.round((o.areaM2 || 0) * (o.waterRate || 20));
        } else if (o.type === 'pipe') {
            icon = '🛠️'; name = o.label || `Strang #${index + 1}`; detail = `${calculatePipeLength(o.points)} m (Ø${o.diameter || 25}mm)`;
        } else if (o.type === 'sprinkler') {
            icon = '🚿'; name = o.name || 'Regner'; detail = `${o.model || 'MP1000'} (${o.radius || 3.5}m)`;
        }

        const isSel = (o === State.selectedObj);
        allElementsHTML += `
            <div onclick="window.selectObjectByIndex(${index})" style="padding:6px 8px; margin-bottom:4px; background:#1e293b; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-size:11px; border:1px solid ${isSel ? '#38bdf8' : 'transparent'};">
                <span>${icon} <strong>${name}</strong></span>
                <span style="color:#94a3b8;">${detail}</span>
            </div>`;
    });

    // 1. HAUPTÜBERSICHT (Wenn kein Einzel-Objekt ausgewählt ist)
    if (!obj) {
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #cbd5e1; font-family:sans-serif;">
                <h3 style="color: #fff; margin-bottom: 10px; font-size:16px;">System-Übersicht</h3>
                
                <!-- Einspeisung & Ventilbox-Setup -->
                <div style="background:#1e293b; padding:10px; border-radius:6px; margin-bottom:12px; border:1px solid #334155;">
                    <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:3px;">Wasserquelle / Einspeisung:</label>
                    <select onchange="window.updateSystemMeta('pumpType', this.value)" style="width:100%; padding:5px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:4px; font-size:11px; margin-bottom:8px;">
                        <option value="pumpe_3m3" ${State.systemMeta.pumpType==='pumpe_3m3'?'selected':''}>Tiefbrunnenpumpe (3,0 m³/h)</option>
                        <option value="pumpe_5m3" ${State.systemMeta.pumpType==='pumpe_5m3'?'selected':''}>Zisternenpumpe (5,0 m³/h)</option>
                        <option value="hausanschluss" ${State.systemMeta.pumpType==='hausanschluss'?'selected':''}>Hauswasseranschluss (DN20)</option>
                    </select>

                    <label style="display:flex; align-items:center; font-size:11px; cursor:pointer; color:#e2e8f0;">
                        <input type="checkbox" ${State.systemMeta.hasCistern ? 'checked' : ''} onchange="window.updateSystemMeta('hasCistern', this.checked)" style="margin-right:6px;">
                        Zisterne vorgeschaltet
                    </label>
                </div>

                <!-- Erfasste Elemente Liste -->
                <div style="max-height:180px; overflow-y:auto; margin-bottom:12px; background:#0f172a; padding:8px; border-radius:6px; border:1px solid #334155;">
                    <p style="font-size:11px; font-weight:bold; color:#38bdf8; margin:0 0 6px 0;">📋 Erfasste Zonen & Bauteile (${State.objects.length}):</p>
                    ${allElementsHTML || '<p style="font-size:11px; color:#64748b; margin:0;">Noch keine Elemente gezeichnet.</p>'}
                </div>

                <!-- GENERIERUNG DER ARBEITSZETTEL & PLÄNE -->
                <div style="background:#0284c7; padding:10px; border-radius:6px; margin-bottom:12px; text-align:center;">
                    <h4 style="margin:0 0 6px 0; color:#fff; font-size:12px;">📄 Montage- & Arbeitszettel</h4>
                    <button onclick="window.generateWorksheets()" style="width:100%; padding:7px; background:#fff; color:#0284c7; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">
                        Arbeitszettel & Pläne generieren
                    </button>
                </div>

                <div style="padding:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:4px; font-size:10px; color:#fcd34d;">
                    ℹ️ <strong>Baustellen-Hinweis:</strong> Rohrleitungen werden automatisch den Ventilen der Verteilerbox zugeordnet.
                </div>
            </div>`;
        return;
    }

    // 2. EINZELANSICHT: ROHRLEITUNG
    if (obj.type === 'pipe') {
        const totalMeters = calculatePipeLength(obj.points);
        targetContainer.innerHTML = `
            <div style="padding: 15px; color: #fff; font-family:sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: ${obj.customColor || '#38bdf8'}; margin:0; font-size:15px;">🛠️ Rohrleitung</h3>
                    <button onclick="window.deselectCurrent()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
                </div>

                <label style="font-size:11px; color:#94a3b8;">Bezeichnung / Strang-Name:</label>
                <input type="text" value="${obj.label || ''}" onchange="window.updatePipeProp('label', this.value)" style="width:100%; padding:5px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px; margin-bottom:8px; font-size:12px;">

                <label style="font-size:11px; color:#94a3b8;">Zuordnung / Zonen-Ventil:</label>
                <select onchange="window.updatePipeProp('valveZone', this.value)" style="width:100%; padding:5px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:4px; margin-bottom:12px; font-size:11px;">
                    <option value="main" ${obj.valveZone === 'main' ? 'selected' : ''}>🔴 Vor Ventilbox (Hauptleitung)</option>
                    <option value="v1" ${obj.valveZone === 'v1' || !obj.valveZone ? 'selected' : ''}>🔵 nach Ventil 1 (Kreis 1)</option>
                    <option value="v2" ${obj.valveZone === 'v2' ? 'selected' : ''}>🟢 nach Ventil 2 (Kreis 2)</option>
                    <option value="v3" ${obj.valveZone === 'v3' ? 'selected' : ''}>🟡 nach Ventil 3 (Kreis 3)</option>
                    <option value="v4" ${obj.valveZone === 'v4' ? 'selected' : ''}>🟣 nach Ventil 4 (Kreis 4)</option>
                </select>

                <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #334155; margin-bottom:12px;">
                    <span style="font-size:11px; color:#94a3b8;">Stranglänge:</span>
                    <strong style="color:#10b981; font-size:14px; float:right;">${totalMeters} m</strong>
                </div>

                <button onclick="window.togglePipeLock()" style="width:100%; padding:8px; background:${obj.allowPointEdit ? '#eab308' : '#3b82f6'}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">
                    ${obj.allowPointEdit ? '🔒 Strang fixieren' : '🔓 Punkte frei verschieben'}
                </button>
            </div>`;
        return;
    }
}

// ARBEITSZETTEL-GENERATOR (Erstellt aufgeteilte Zettel für die Monteure)
window.generateWorksheets = () => {
    const pipes = State.objects.filter(o => o.type === 'pipe');
    const sprinklers = State.objects.filter(o => o.type === 'sprinkler');

    let report = "==========================================\n";
    report += " 🏗️ MONTAGE- & ARBEITSZETTEL-BEWÄSSERUNG\n";
    report += "==========================================\n\n";

    // ZETTEL 0: Vor der Ventilbox
    const mainPipes = pipes.filter(p => p.valveZone === 'main');
    let mainMeters = mainPipes.reduce((acc, p) => acc + calculatePipeLength(p.points), 0);
    
    report += "------------------------------------------\n";
    report += "📄 ARBEITSZETTEL 0: ZULEITUNG & VENTILBOX\n";
    report += "------------------------------------------\n";
    report += `• Einspeisung: ${State.systemMeta.pumpType || 'Standard-Pumpe'}\n`;
    report += `• Zuleitung bis Box: ${mainMeters.toFixed(2)} m PE-Rohr\n`;
    report += `• Hauptkomponenten: Filter, Druckminderer, Verteiler\n\n`;

    // ZETTEL FOR JEDES VENTIL (1 bis 4)
    ['v1', 'v2', 'v3', 'v4'].forEach((vKey, idx) => {
        const zonePipes = pipes.filter(p => p.valveZone === vKey || (!p.valveZone && vKey === 'v1'));
        const zoneMeters = zonePipes.reduce((acc, p) => acc + calculatePipeLength(p.points), 0);
        
        if (zonePipes.length > 0 || idx === 0) {
            report += "------------------------------------------\n";
            report += `📄 ARBEITSZETTEL ${idx + 1}: VENTILKREIS ${idx + 1}\n`;
            report += "------------------------------------------\n";
            report += `• Trassenlänge: ${zoneMeters.toFixed(2)} m Rohrleitung\n`;
            report += `• Anbohrschellen / T-Stücke: ${sprinklers.length} Stück\n`;
            report += `• Flexschlauch (0,5m pro Regner): ${(sprinklers.length * 0.5).toFixed(1)} m\n`;
            report += `• Installierte Regner: ${sprinklers.length}x MP-Rotator\n\n`;
        }
    });

    // In neuem Fenster/Tab als Druckansicht ausgeben
    const win = window.open("", "_blank");
    win.document.write(`<pre style="font-family:monospace; font-size:13px; background:#1e293b; color:#f8fafc; padding:20px;">${report}</pre>`);
};

window.selectObjectByIndex = (index) => {
    if (State.objects[index]) {
        State.selectedObj = State.objects[index];
        updateSidebar(State.selectedObj);
        if (typeof window.draw === 'function') window.draw();
    }
};
