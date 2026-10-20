import kafkaJavascript from '@confluentinc/kafka-javascript';
import { config } from './config.js';

const { Kafka, logLevel } = kafkaJavascript.KafkaJS;

/** One place that turns the KAFKA_* settings into a client, so the producer, consumer and tools agree. */
export function createKafka(overrides: { logLevel?: number } = {}) {
  const { brokers, clientId, saslUsername, saslPassword, saslMechanism, ssl, sslCaLocation } = config.kafka;
  return new Kafka({
    kafkaJS: {
      brokers,
      clientId,
      logLevel: overrides.logLevel ?? logLevel.WARN,
      ssl,
      ...(saslUsername ? { sasl: { mechanism: saslMechanism, username: saslUsername, password: saslPassword ?? '' } } : {}),
    },
    ...(sslCaLocation ? { 'ssl.ca.location': sslCaLocation } : {}),
  });
}

export { logLevel };
