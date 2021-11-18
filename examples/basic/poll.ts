import { SQS } from 'aws-sdk';

const sqs = new SQS();

export const handler = async () => {
  const received = await sqs.receiveMessage({
    MaxNumberOfMessages: 3,
    WaitTimeSeconds: 10,
    QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
  }).promise();
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/json' },
    body: JSON.stringify({ received }, null, 2),
  }
}