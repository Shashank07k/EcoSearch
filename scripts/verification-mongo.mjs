// Hosting-harness verification helper; not a production database or app dependency.
// Starts a real temporary mongod. Data lasts only for this verification session.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create({
  instance: { port: 27017, ip: '127.0.0.1', dbName: 'ecosearch' },
});
console.log('VERIFICATION_MONGO_READY');
const timer = setInterval(() => {}, 60_000);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await mongo.stop();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
