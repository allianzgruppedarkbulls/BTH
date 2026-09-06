// js/state.js - Central Application State
export const State = {
    // Canvas & Zoom Transformation
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    
    // Workflow Phase
    activeTool: 'select', // 'upload', 'scale', 'draw-lawn', 'add-source', 'add-sprinkler', 'draw-pipe'
    
    // Scale Calibration
    pixelsPerMeter: 20.0, // Default 20px = 1m
    scaleLine: null,      // { start: {x,y}, end: {x,y} }

    // Data Store
    bgImage: null,
    objects: [],          // Lawns, Deadzones, Sprinklers, Pipes, Sources
    selectedObj: null,

    // Settings
    currentZone: 'v1',    // 'main', 'v1', 'v2', etc.
    currentPipeDiameter: 25
};
