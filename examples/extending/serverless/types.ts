// Define CloudFormation resource ids by type
export type TopicIds = 'MySnsTopic';
export type FunctionIds = 'Send' | 'Forward' | 'Poll';
export type QueueIds = 'FirstQueue' | 'SecondQueue';

// Define possible output ids
export type OutputsIds = 'MyFirstQueueName' | 'MyFirstQueueUrl';

// Define all CloudFormation resource ids
export type ResourceIds = TopicIds | FunctionIds | QueueIds;

// Helps we enforce type safe Cloudformation Outputs
export type Output = { Description: string; Value: unknown };

// Custom resources parameters
export type CustomResourceParams = {
  name: string;
  tags?: {
    [k: string]: string;
  };
  tagsArray?: { Key: string; Value: string }[];
};
