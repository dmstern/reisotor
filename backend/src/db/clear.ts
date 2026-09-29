import '../loadEnv.js';
import { clearDatabase, db } from './index.js';

if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_DB_CLEAR) {
  console.error('Fehler: Datenbank leeren ist in der Produktionsumgebung gesperrt.');
  process.exit(1);
}

clearDatabase(db, { clearUploads: true });
console.log('Datenbank und Uploads erfolgreich geleert.');
