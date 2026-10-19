import kafkaJavascript from '@confluentinc/kafka-javascript';
import { config } from './config.js';
import type { KafkaMessage, ReportPublisher } from './scheduler/types.js';

const { Kafka, logLevel } = kafkaJavascript.KafkaJS;

const kafka = new Kafka({
  kafkaJS: {
    brokers: config.kafka.brokers,
    clientId: config.kafka.clientId,
    logLevel: logLevel.WARN,
  },
});

const producer = kafka.producer({
  'message.timeout.ms': config.kafka.deliveryTimeoutMs,
  kafkaJS: {
    // Wait for all in-sync replicas, and let the broker drop retried duplicates.
    acks: -1,
    idempotent: true,
    retry: { retries: config.kafka.producerRetries },
  },
});

// Connect on first send, so the API still starts while Kafka is down.
let connecting: Promise<void> | null = null;

function ensureConnected(): Promise<void> {
  connecting ??= producer.connect().catch((error: unknown) => {
    connecting = null;
    throw error;
  });
  return connecting;
}

export const reportPublisher: ReportPublisher & { disconnect(): Promise<void> } = {
  async send(messages: KafkaMessage[]) {
    try {
      await ensureConnected();
      await producer.send({ topic: config.kafka.reportsTopic, messages });
    } catch (error) {
      // The message becomes the run's failure_reason, e.g. "Kafka send failed: Local: Message timed out".
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Kafka send failed: ${reason}`);
    }
  },

  async disconnect() {
    if (connecting === null) return;
    await connecting.catch(() => undefined);
    connecting = null;
    await producer.disconnect();
  },
};
