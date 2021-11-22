import type { AWS } from '@serverless/typescript';
import { SQS, SNS, Fn } from 'typed-aws';
import { typed, printConfig } from './serverless/base';

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
    tags: {
      myCustomTag: 'basic-sample',
    },
    iam: {
      role: {
        statements: [
          ...typed.policies.sqsFullAccess('FirstQueue'),
          ...typed.policies.sqsFullAccess('SecondQueue'),
          ...typed.policies.lambdaInvokeFunction('Forward'),
          ...typed.policies.snsPublish('MySnsTopic'),
        ],
      },
    },
  },
  plugins: ['serverless-esbuild'],
  resources: {
    Resources: {
      ...typed.resources({
        FirstQueue: ({ name, awsTags }) =>
          SQS.Queue({
            QueueName: name,
            VisibilityTimeout: 60,
            Tags: awsTags,
          }),
        SecondQueue: ({ name, awsTags }) =>
          SQS.Queue({
            QueueName: name,
            VisibilityTimeout: 60,
            Tags: awsTags,
          }),
      }),
      ...typed.resources({
        MySnsTopic: ({ name, awsTags }) =>
          SNS.Topic({
            TopicName: name,
            DisplayName: 'Forward messages to SecondQueue',
            Tags: awsTags,
          }),
      }),
    },
    Outputs: typed.outputs({
      MyFirstQueueName: {
        Description: 'My first queue name',
        Value: typed.getName('FirstQueue'),
      },
      MyFirstQueueUrl: {
        Description: 'My first queue URL',
        Value: typed.ref('FirstQueue'),
      },
    }),
  },
  functions: typed.functions({
    // Send a message to a FirstQueue (Open /send?message=some+message in your browser)
    Send: ({ name }) => ({
      name,
      handler: './lambdas/sender.handler',
      events: [{ http: { method: 'get', path: 'send' } }],
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
          usingCFExpressions: typed.cfn(
            Fn.Sub('myqueue is ${queue}', { queue: typed.ref('FirstQueue') })
          ),
        }),
      },
    }),
    // Automatically triggered by any message sent to FirstQueue,
    // and than we forward it to SecondQueue
    Forward: ({ name }) => ({
      name,
      handler: './lambdas/forward.handler',
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
      handler: './lambdas/poll.handler',
      events: [{ http: { method: 'get', path: 'poll' } }],
      environment: {
        QUEUE_URL: typed.ref('SecondQueue'), // type safe reference to a resource
      },
    }),
  }),
};

module.exports = printConfig(typed.build(serverlessConfiguration));
