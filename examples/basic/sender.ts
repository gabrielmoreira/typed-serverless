import { SQS, Lambda, SNS } from 'aws-sdk';

const sqs = new SQS();
const lambda = new Lambda();
const sns = new SNS();

export const handler = async (raw) => {
  console.log('[Sender] Received', raw);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { multiValueHeaders, multiValueQueryStringParameters, ...event } = raw;
  const myId =
    new Date().toISOString() +
    '_' +
    (Math.random() + 1).toString(36).substring(7);
  const message = {
    myId,
    event,
    MY_CUSTOM_JSON: JSON.parse(process.env.MY_CUSTOM_JSON),
  };
  if (event?.queryStringParameters?.lambda) {
    await lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME,
        Payload: JSON.stringify({ invokeLambdaWith: message }),
      })
      .promise();
  } else if (event?.queryStringParameters?.sns) {
    await sns
      .publish({
        TopicArn: process.env.TOPIC_ARN,
        Message: JSON.stringify({ publishSnsWith: message }),
      })
      .promise();
  } else {
    await sqs
      .sendMessage({
        MessageBody: JSON.stringify({ sendMessageWith: message }),
        QueueUrl: process.env.QUEUE_URL || 'QueueUrlNotFound',
      })
      .promise();
  }
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/json' },
    body: JSON.stringify(message, null, 2),
  };
};
