import type { AWS } from '@serverless/typescript';
import {
  createTypedServerless,
  getServerlessStage,
  BaseResourceParams,
} from '../../src'; // use 'typed-serverless' here

// Define CloudFormation resource ids by type
export type TopicIds = 'MySnsTopic';
export type FunctionIds = 'Send' | 'Forward' | 'Poll';
export type QueueIds = 'FirstQueue' | 'SecondQueue';

// Define possible output ids
export type OutputsIds = 'MyFirstQueueName' | 'MyFirstQueueUrl';

// Define all CloudFormation resource ids
export type ResourceIds = TopicIds | FunctionIds | QueueIds;

// Create a new TypedServerless instance
const typed = createTypedServerless<AWS, ResourceIds, MyCustomResourceParams>({
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

export default typed;

// Helps you enforce type safe Cloudformation Outputs
type Output = { Description: string; Value: unknown };
export const outputs = (outputs: { [key in OutputsIds]?: Output }) => outputs;

// Helps you enforce type safe IAM Role/Policies references to resources
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

// Custom resources parameters
export type MyCustomResourceParams = BaseResourceParams & {
  tags?: {
    [k: string]: string;
  };
  tagsArray?: { Key: string; Value: string }[];
};
