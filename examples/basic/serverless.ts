import type { AWS } from '@serverless/typescript';
import { SQS, SNS } from '../../src';
import typed, { policies } from './typed-serverless';

const serverlessConfiguration: AWS = {
  service: 'basic',
  frameworkVersion: '*',
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    region: 'eu-west-1',
    memorySize: 128,
    lambdaHashingVersion: '20201221',
    timeout: 30,
    iam: {
      role: {
        statements: [
          ...policies.sqsFullAccess('FirstQueue'),
          ...policies.sqsFullAccess('SecondQueue'),
          ...policies.lambdaInvokeFunction('Forward'),
          ...policies.snsPublish('MySnsTopic'),
        ],
      },
    },
  },
  plugins: ['serverless-esbuild'],
  resources: {
    Resources: typed.resources({
      // Defines our resources in a type safe manner
      FirstQueue: ({ name }) =>
        new SQS.Queue({
          QueueName: name,
          VisibilityTimeout: 60,
        }),
      SecondQueue: ({ name }) =>
        new SQS.Queue({
          QueueName: name,
          VisibilityTimeout: 60,
        }),
      MySnsTopic: ({ name }) =>
        new SNS.Topic({
          TopicName: name,
          DisplayName: 'Forward messages to SecondQueue',
        }),
    }),
  },
  functions: typed.functions({
    // Send a message to a FirstQueue (Open /send?message=some+message in your browser)
    Send: ({ name }) => ({
      name,
      handler: './sender.handler',
      environment: {
        // type safe reference to a queue, it fails if this ref is not previously registered
        QUEUE_URL: typed.ref('FirstQueue'),
        // type safe reference to another lambda:
        FUNCTION_NAME: typed.ref('Forward'),
        // type safe reference to a sns topic:
        TOPIC_ARN: typed.ref('MySnsTopic'),
        // below a more advanced scenario, typed.stringfy will resolve all CF functions before stringify it
        MY_CUSTOM_JSON: typed.stringify({
          myQueueRef: typed.ref('FirstQueue'),
          myQueueArn: typed.getArn('FirstQueue'),
          myQueueName: typed.getAtt('FirstQueue', 'QueueName'),
          myQueueGivenName: typed.getName('FirstQueue'),
          myLambdaRef: typed.ref('Forward'),
          myLambdaArn: typed.getArn('Forward'),
          myLambdaGivenName: typed.getName('Forward'),
        }),
      },
      events: [
        {
          http: {
            method: 'get',
            path: 'send',
          },
        },
      ],
    }),
    // Automatically triggered by any message sent to FirstQueue,
    // and than we forward it to SecondQueue
    Forward: ({ name }) => ({
      name,
      handler: './forward.handler',
      environment: {
        QUEUE_URL: typed.ref('SecondQueue'), // type safe reference to a resource
      },
      events: [
        {
          sqs: {
            arn: typed.getArn('FirstQueue'), // type safe reference to a resource
            batchSize: 1,
          },
        },
        {
          sns: {
            arn: typed.ref('MySnsTopic'),
            topicName: typed.getName('MySnsTopic'), // topicName is also required -> https://www.serverless.com/framework/docs/providers/aws/events/sns
          },
        },
      ],
    }),
    // Poll a message from SecondQueue (Open /poll in your browser)
    Poll: ({ name }) => ({
      name,
      handler: './poll.handler',
      environment: {
        QUEUE_URL: typed.ref('SecondQueue'), // type safe reference to a resource
      },
      events: [
        {
          http: {
            method: 'get',
            path: 'poll',
          },
        },
      ],
    }),
  }),
};

const print = (t) => {
  console.log('Final configuration:');
  console.dir(t, { depth: 999 });
  console.log('');
  return t;
};

module.exports = print(typed.build(serverlessConfiguration));
