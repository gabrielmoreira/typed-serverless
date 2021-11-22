import { SQS } from 'aws-sdk';
import { parseAllNestedJsonStrings } from './utils';

const sqs = new SQS();

export const handler = async () => {
  const received = await sqs
    .receiveMessage({
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
    })
    .promise();
  console.log("[Poll] Received", received);
  await Promise.all(
    received?.Messages?.map(async (message) => {
      if (message.ReceiptHandle) {
        console.log('Deleting message', message.ReceiptHandle);
        await sqs.deleteMessage({
          QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
          ReceiptHandle: message.ReceiptHandle,
        });
        console.log('Message deleted', message.ReceiptHandle);
      }
    }) || []
  );
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/json' },
    body: JSON.stringify(
      { received: parseAllNestedJsonStrings(received) },
      null,
      2
    ),
  };
};
