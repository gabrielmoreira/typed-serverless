import type { AWS } from '@serverless/typescript';
import { createTypedServerless, SQS } from '../../src';

type ResourceIds = 'FirstQueue' | 'SecondQueue';

const s = createTypedServerless<AWS, ResourceIds>({
  resourceParamsFactory: (id, config) => {
    // Create consistent names from logical ids
    return { name: `${config.service}-${id}` };
  },
});

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
          { Effect: 'Allow', Action: 'sqs:*', Resource: s.getArn('FirstQueue') },
          { Effect: 'Allow', Action: 'sqs:*', Resource: s.getArn('SecondQueue') },
        ]
      }
    }
  },
  plugins: ['serverless-esbuild'],
  resources: {
    Resources: {
      // Defines a resource in a typesafe manner
      ...s.resource(
        'FirstQueue',
        ({ name }) =>
          new SQS.Queue({
            QueueName: name,
          })
      ),
      ...s.resource(
        'SecondQueue',
        ({ name }) =>
          new SQS.Queue({
            QueueName: name,
          })
      ),
    },
  },
  functions: {
    // Send a message to a FirstQueue (Open /send?message=some+message in your browser)
    sender: {
      handler: './sender.handler',
      environment: {
        QUEUE_URL: s.ref('FirstQueue'), // typesafe reference to a resource
      },
      events: [
        {
          http: {
            method: 'get',
            path: 'send',
          },
        },
      ],
    },
    // Automatically triggered by any message sent to FirstQueue,
    // and than we send this message to SecondQueue
    receiver: {
      handler: './receiver.handler',
      environment: {
        QUEUE_URL: s.ref('SecondQueue'), // typesafe reference to a resource
      },
      events: [
        {
          sqs: {
            arn: s.getArn('FirstQueue'), // typesafe reference to a resource
          }
        },
      ],
    },
    // Poll a message from SecondQueue (Open /poll in your browser)
    poll: {
      handler: './poll.handler',
      environment: {
        QUEUE_URL: s.ref('SecondQueue'), // typesafe reference to a resource
      },
      events: [
        {
          http: {
            method: 'get',
            path: 'poll',
          },
        },
      ],
    }
  },
};

const print = (t) => {
  console.log('Final configuration:')
  console.dir(t, { depth: 999 });
  console.log('');
  return t;
}
module.exports = print(s.build(serverlessConfiguration).config);
