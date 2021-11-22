import type { AWS } from '@serverless/typescript';
import {
  ResourceIds,
  CustomResourceParams,
  OutputsIds,
  Output,
  QueueIds,
  FunctionIds,
  TopicIds,
} from './types';
import { createTypedServerless, getServerlessStage } from '../../../src'; // use 'typed-serverless' here

// Create a new TypedServerless instance
export const typed = createTypedServerless<
  AWS,
  ResourceIds,
  CustomResourceParams
>({
  // resourceParamsFactory function will be invoked BEFORE each resource created with
  // typed.resources('id', (Params) => SQS.Queue({ Name: Params.name }))
  // where Params will be the result of the following function execution:
  resourceParamsFactory: (id, config) => {
    return {
      // Create consistent name from logical ids
      name: `${config.service}-${getServerlessStage()}-${id}`,
      // Pass tags to all resources
      tags: config.provider.tags,
      // Transform tags {key: value}, to Array<{Key: string, Value: string}>
      tagsArray:
        config.provider.tags &&
        Object.entries(config.provider.tags).map((it) => ({
          Key: it[0],
          Value: it[1],
        })),
    };
  },
});

// Helps we enforce all outputs are using valid ids
export const outputs = (outputs: { [key in OutputsIds]?: Output }) => outputs;

// Helps we enforce type safe IAM Role/Policies references to resources
export const policies = {
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
};

// Helps we print our final Serverless config as a JSON string
export const printConfig = (t: unknown) => {
  console.log('Final configuration:');
  console.dir(JSON.parse(JSON.stringify(t)), { depth: 999 });
  console.log('');
  return t;
};
