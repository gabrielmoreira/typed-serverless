import type { AWS } from '@serverless/typescript';
import { TypedServerless, SQS } from '../../src';
//import { TypedServerless } from 'typed-serverless';

type ResourceIds = 'MyQueue' | 'SendMessageFn';
type OutputIds = 'MyQueueUrl';
const typed = TypedServerless.createDefault<ResourceIds>();

const serverlessConfiguration: AWS = {
  service: 'minimal',
  plugins: ['serverless-esbuild'],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    region: 'eu-west-1',
    lambdaHashingVersion: '20201221',
    tags: {
      myCustomTag: 'my-sample-tag',
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: 'sqs:*',
            Resource: typed.getArn('MyQueue'),
          },
        ],
      },
    },
  },
  resources: {
    Resources: {
      ...typed.resources({
        MyQueue: ({ name, awsTags }) =>
          SQS.Queue({
            QueueName: name,
            VisibilityTimeout: 60,
            Tags: awsTags,
          }),
      }),
    },
    Outputs: typed.only<OutputIds>({
      MyQueueUrl: {
        Description: 'Exposing my queue url for other stacks',
        Value: typed.ref('MyQueue'),
      },
    }),
  },
  functions: typed.functions({
    // Send a message to a FirstQueue (Open /send?message=some+message in your browser)
    SendMessageFn: ({ name }) => ({
      name,
      handler: './mylambda.handler',
      events: [{ http: { method: 'get', path: 'send' } }],
      environment: {
        // type safe reference to a queue, it fails if this ref is not previously registered
        QUEUE_URL: typed.ref('MyQueue'),
      },
    }),
  }),
};

module.exports = typed.build(serverlessConfiguration);
