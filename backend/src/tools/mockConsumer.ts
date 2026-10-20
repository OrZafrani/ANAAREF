/**
 * Prints every message that arrives on reports.enriched, standing in for Specter
 * while developing the scheduler.
 *
 *   npm run kafka:consume -w backend                    new messages only
 *   npm run kafka:consume -w backend -- --from-beginning
 */
import { config } from '../config.js';
import { createKafka } from '../kafkaClient.js';

const fromBeginning = process.argv.includes('--from-beginning');
const kafka = createKafka();
const consumer = kafka.consumer({
  kafkaJS: { groupId: `cobra-mock-consumer-${process.pid}`, fromBeginning },
});

await consumer.connect();
await consumer.subscribe({ topic: config.kafka.reportsTopic });
console.log(`Listening on ${config.kafka.reportsTopic} at ${config.kafka.brokers.join(', ')}. Ctrl+C to stop.`);

await consumer.run({
  eachMessage: async ({ partition, message }) => {
    const report = JSON.parse(message.value?.toString() ?? 'null');
    console.log([
      new Date().toISOString(),
      `p${partition}`,
      message.key?.toString(),
      `collected_at=${report?.collected_at}`,
      report?.report_title ?? '(no title)',
    ].join('  '));
  },
});

process.on('SIGINT', () => {
  void consumer.disconnect().finally(() => process.exit(0));
});
