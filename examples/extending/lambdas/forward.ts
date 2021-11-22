import { SQS } from 'aws-sdk';

const sqs = new SQS();

export const handler = async (event) => {
  console.log('[Forward] Received', event);
  await sqs
    .sendMessage({
      MessageBody: JSON.stringify({ forwardWith: event }),
      QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
    })
    .promise();
  console.log('Forwarded', event);
};
