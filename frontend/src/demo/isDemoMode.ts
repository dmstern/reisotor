// Einzige Quelle der Wahrheit dafür, ob das Frontend gerade als backend-loser Demo-Build läuft
// (statisches GitHub-Pages-Deployment mit Dummy-Daten, siehe Issue #172) - überall sonst diesen
// Wert importieren statt den Env-Check zu wiederholen.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
