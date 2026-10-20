/**
 * Connects to the broker from backend/.env and reports whether it works.
 *
 *   npm run kafka:check -w backend
 */
import { config } from '../config.js';
import { createKafka, logLevel } from '../kafkaClient.js';

const { brokers, reportsTopic, saslUsername, ssl } = config.kafka;
console.log(`Brokers: ${brokers.join(', ')}  (TLS: ${ssl ? 'on' : 'off'}, SASL user: ${saslUsername ?? 'none'})`);

const admin = createKafka({ logLevel: logLevel.ERROR }).admin();
const timeout = setTimeout(() => {
  console.error('FAILED: no response within 15s. Is the broker address reachable from this machine?');
  process.exit(1);
}, 15_000);

try {
  await admin.connect();
  const topics = await admin.listTopics();
  console.log(`Connected. ${topics.length} topics visible.`);
  console.log(
    topics.includes(reportsTopic)
      ? `Topic "${reportsTopic}" exists.`
      : `WARNING: topic "${reportsTopic}" not found (auto-create may be off, or the user lacks access).`,
  );
  await admin.disconnect();
  clearTimeout(timeout);
} catch (error) {
  console.error('FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
}
