/**
 * Serverless has a special logical id naming convention for the resources they manage.
 * So this function converts from our logical ids to the serverless ones.
 *
 * @see https://www.serverless.com/framework/docs/providers/aws/guide/resources/#override-aws-cloudformation-resource
 * @see https://github.com/serverless/serverless/blob/8d56d0e520db8068e89fa8d4d2bf4e64b0acd97b/lib/plugins/aws/lib/naming.js#L583
 */
export function getServerlessAwsResourceName<T extends string = string>(
  resourceName: T
): T {
  const normalizedName = resourceName
    .replace(/-/g, 'Dash')
    .replace(/_/g, 'Underscore');
  return (normalizedName[0].toUpperCase() + normalizedName.substring(1)) as T;
}

/**
 * Serverless has a special logical id naming convention for lambdas.
 * So this function converts from our logical ids to the serverless ones.
 *
 * @see https://www.serverless.com/framework/docs/providers/aws/guide/resources/#override-aws-cloudformation-resource
 * @see https://github.com/serverless/serverless/blob/8d56d0e520db8068e89fa8d4d2bf4e64b0acd97b/lib/plugins/aws/lib/naming.js#L146
 */
export function getServerlessAwsFunctionLogicalId<T extends string = string>(
  id: T
): T {
  return `${getServerlessAwsResourceName(id)}LambdaFunction` as T;
}
