import {
  OutputsIds,
  Output,
  QueueIds,
  FunctionIds,
  TopicIds,
  ResourceIds,
} from './types';

import { TypedServerless } from '../../../src';
// import { TypedServerless } from 'typed-serverless';

// Create a new TypedServerless instance
export const typed = TypedServerless.createDefault<ResourceIds>()
  // extends this TypedServerless instance with following properties
  .extendsWith((typed) => ({
    // Helps we enforce that outputs are using valid ids
    outputs: typed.onlyFactory<OutputsIds, Output>(),
    // Helps we enforce type safe IAM Role/Policies references to resources
    policies: {
      sqsFullAccess: (queueId: QueueIds) => [
        {
          Effect: 'Allow',
          Action: 'sqs:*',
          Resource: typed.getArn(queueId),
        },
      ],
      lambdaInvokeFunction: (functionId: FunctionIds) => [
        {
          Effect: 'Allow',
          Action: 'lambda:InvokeFunction',
          // Using buildLambdaArn instead of getArn to avoid CloudFormation circular dependency error...
          // Read more about it https://aws.amazon.com/pt/blogs/infrastructure-and-automation/handling-circular-dependency-errors-in-aws-cloudformation/
          Resource: typed.buildLambdaArn(functionId),
        },
      ],
      snsPublish: (topicId: TopicIds) => [
        {
          Effect: 'Allow',
          Action: 'SNS:Publish',
          Resource: typed.ref(topicId),
        },
      ],
    },
  }));

// Helps we print our final Serverless config as a JSON string
export const printConfig = (t: unknown) => {
  console.log('Final configuration:');
  console.dir(JSON.parse(JSON.stringify(t)), { depth: 999 });
  console.log('');
  return t;
};
