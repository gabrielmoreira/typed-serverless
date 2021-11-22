import { SQS } from 'aws-sdk';

const sqs = new SQS();

export const handler = async (event) => {
  const messageSent = await sqs
    .sendMessage({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify({
        createdAt: new Date().toISOString(),
        event,
      }),
    })
    .promise();
  return { statusCode: 200, body: JSON.stringify({ messageSent })};
};
