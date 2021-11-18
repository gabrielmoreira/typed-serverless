import { SQS } from 'aws-sdk';

const sqs = new SQS();

export const handler = async (event) => {
  await sqs
    .sendMessage({
      MessageBody: JSON.stringify(event),
      QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
    })
    .promise();
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/json' },
    body: JSON.stringify({ event }, null, 2),
  };
};
