import webpush from 'web-push';

// Einmalig ausführen (npx tsx scripts/generate-vapid-keys.mjs bzw. node nach dem Build), Ausgabe als
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY in die jeweilige .env-Datei übernehmen (dev + prod bekommen
// üblicherweise unterschiedliche Schlüssel). Ohne diese Env-Vars bleibt Push einfach deaktiviert
// (siehe push.ts) statt die App zum Absturz zu bringen.
const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
