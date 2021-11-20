import { FnSub } from './types';

/*
 * @link https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
 * Valid formats:
 * - 'arn:partition:service:region:account-id:resource-id'
 * - 'arn:partition:service:region:account-id:resource-type/resource-id'
 * - 'arn:partition:service:region:account-id:resource-type:resource-id'
 */
export type BuildArnParams<ResourceId> = {
  partition?: string;
  service?: string;
  region?: string;
  namespace?: string;
  type?: string;
  resourceId: ResourceId;
  path?: string;
  typeToResourceSeparator?: ':' | '/';
};

export type BuildArnParamsWithoutResourceId = Omit<
  BuildArnParams<string>,
  'resourceId'
>;

/**
 * Build Lambda ARN as a clouformation string expression.
 * format "arn:aws:lambda:[[region]]:[[accountId]]:function:[[function]]"
 * https://docs.aws.amazon.com/lambda/latest/dg/lambda-api-permissions-ref.html
 */
export function lambdaArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'lambda',
    type: 'function',
    resourceId,
  };
}

/**
 * Build Bucket ARN as a clouformation string expression.
 * bucket arn:        "arn:aws:s3:::bucket_name"
 * bucket object arn: "arn:aws:s3:::bucket_name/key_name"
 * bucket path arn:   "arn:aws:s3:::bucket_name/some/folder/*"
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-arn-format.html
 */
export function bucketArn<ResourceId>(
  resourceId: ResourceId,
  path?: string
): BuildArnParams<ResourceId> {
  return {
    service: 's3',
    region: '',
    namespace: '',
    resourceId,
    path,
  };
}
/**
 * Build SNS ARN as a clouformation string expression.
 * format: "arn:aws:sns:[[region]]:[[accountId]]:[[topicName]]"
 * @link https://docs.aws.amazon.com/step-functions/latest/dg/sns-iam.html
 */
export function snsArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'sns',
    resourceId,
  };
}
/**
 * Build EventBus ARN as a clouformation string expression.
 * format: "arn:aws:events:[[region]]:[[accountId]]:event-bus:[[queueName]]"
 * @link https://docs.aws.amazon.com/step-functions/latest/dg/eventbridge-iam.html
 */
export function eventBusArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'events',
    type: 'event-bus',
    typeToResourceSeparator: '/',
    resourceId,
  };
}
/**
 * Build SQS ARN as a clouformation string expression.
 * format: "arn:aws:sqs:[[region]]:[[accountId]]:[[queueName]]"
 * @link https://docs.aws.amazon.com/step-functions/latest/dg/sqs-iam.html
 */
export function sqsArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'sqs',
    resourceId,
  };
}
/**
 * Build StepFunction ARN as a clouformation string expression.
 * format: "arn:aws:states:[[region]]:[[accountId]]:stateMachine:[[stateMachineName]]"
 * @link https://docs.aws.amazon.com/step-functions/latest/dg/stepfunctions-iam.html
 * @deprecated Prefer #arn - AWS Step Function automatically adds a name suffix, because of that this function will not be able to generate correct arn
 */
export function stepFunctionArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'states',
    type: 'stateMachine',
    resourceId,
  };
}

/**
 * Build Alarm ARN as a clouformation string expression.
 * format: "arn:aws:cloudwatch:[[region]]:[[accountId]]:alarm:[[alarmName]]"
 * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cw-alarm.html
 */
export function alarmArn<ResourceId>(
  resourceId: ResourceId
): BuildArnParams<ResourceId> {
  return {
    service: 'cloudwatch',
    type: 'alarm',
    resourceId,
  };
}
/**
 * Build an ARN as a clouformation string expression.
 * format: "arn:aws:[[service]]:[[region]]:[[type]]:[[id]][[path]]"
 * type and path are optional
 * @example "arn:aws:states:eu-west-1:stateMachine:MyStateMachineName"
 * https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
 */
export function buildArnFnSub<ResourceId>({
  partition,
  service,
  region = '${AWS::Region}',
  namespace = '${AWS::AccountId}',
  type,
  resourceId,
  path,
  typeToResourceSeparator = ':',
}: BuildArnParams<ResourceId>): FnSub {
  const arn =
    ['arn', partition || 'aws', service, region || '', namespace || '', type]
      .filter((x) => typeof x !== 'undefined')
      .join(':') +
    typeToResourceSeparator +
    resourceId +
    (path || '');
  if (path && path[0] !== '/')
    throw new Error("Arn path should always starts with '/'");
  return { 'Fn::Sub': arn };
}
