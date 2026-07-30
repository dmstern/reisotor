// Feste Login-Daten für die e2e-Suite — bewusst NICHT die README-Standardwerte (user1/changeme1),
// damit dieser Test-Login nie mit einem echten/lokalen Dev-Account verwechselt wird. Gelten nur für
// die wegwerfbare Test-DB unter e2e/.tmp/, nie für echte Daten. Von playwright.config.ts (webServer
// env), global-setup.ts (Seed-Aufruf) und tests/auth.setup.ts (Login) gemeinsam importiert, damit
// sie nicht auseinanderdriften können.
export const E2E_USERNAME = 'e2e-user1';
export const E2E_PASSWORD = 'e2e-changeme-1';
export const E2E_USERNAME_2 = 'e2e-user2';
export const E2E_PASSWORD_2 = 'e2e-changeme-2';
export const E2E_SESSION_SECRET = 'e2e-fixed-secret-not-for-prod-32chars';

// Bewusst NICHT 3000/5173 (die Ports des normalen lokalen Dev-Servers, siehe .vscode/tasks.json) —
// die e2e-Suite läuft dank CORS_ORIGIN (backend/src/server.ts) auf eigenen Ports parallel dazu,
// ohne den echten Dev-Server je stoppen zu müssen.
export const E2E_BACKEND_PORT = 3100;
export const E2E_FRONTEND_PORT = 5273;
