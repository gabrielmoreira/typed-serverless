import { AWS } from '@serverless/typescript';
import { CfnResourceProps, ICfnResource } from 'typed-aws';

export type ResourceProps = CfnResourceProps;
export type Resource<T extends CfnResourceProps> = ICfnResource<T>;

export type ResourceBuilder<
  TResourceBuilderParams,
  T extends CfnResourceProps = CfnResourceProps
> = (resource: TResourceBuilderParams) => Resource<T>;

export type Resources<
  TResourceId extends string,
  TResource extends Resource<TResourceProps>,
  TResourceProps extends CfnResourceProps = CfnResourceProps
> = {
  [key in TResourceId]?: ResourceAdapter<TResource, TResourceProps>;
};

export type ServerlessAWSResource = Exclude<AWSResources, undefined>[string];

export type ResourceAdapter<
  T,
  X extends CfnResourceProps
> = T extends Resource<X> ? ServerlessAWSResource : T;

export type FunctionBuilder<TFunctionBuilderParams> = (
  resource: TFunctionBuilderParams
) => ServerlessAWSFunction;

export type Functions<TFunctionId extends string> = {
  [key in TFunctionId]?: ServerlessAWSFunction;
};

export type ServerlessAWSFunction = Exclude<
  AWS['functions'],
  undefined
>[string];

type AWSResources = Exclude<
  Exclude<AWS['resources'], undefined>['Resources'],
  undefined
>;

export type FnSub =
  | { 'Fn::Sub': string }
  | { 'Fn::Sub': [string, Record<string, unknown>] };
