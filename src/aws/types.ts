import { AWS } from '@serverless/typescript';
import { CfnResourceProps, ICfnResource } from 'typed-aws';

export type BaseResourceParams = {
  name: string;
};

export type ResourceType = 'resource' | 'function';
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

type ServerlessAWSFunction = Exclude<AWS['functions'], undefined>[string];

export type ServerlessFunction = ServerlessAWSFunction;

type AWSResources = Exclude<
  Exclude<AWS['resources'], undefined>['Resources'],
  undefined
>;

export type FnSub =
  | { 'Fn::Sub': string }
  | { 'Fn::Sub': [string, Record<string, unknown>] };

export type ProcessContext<T> = {
  config: T;
  resourceNames: Record<string, string>;
  resourceTypes: Record<string, ResourceType>;
  errors: string[];
};

export type HookPhase =
  | 'before-resource'
  | 'after-resource'
  | 'before-reference'
  | 'after-reference'
  | 'before-stringify'
  | 'after-stringify';

export type HookProcessor<TConfigType> = (
  context: ProcessContext<TConfigType>
) => void;
export type Hooks<TConfigType> = {
  [key in HookPhase]?: HookProcessor<TConfigType>;
};

export type TypedServerlessParams<
  TId extends string = string,
  TResourceParams extends BaseResourceParams = BaseResourceParams,
  TConfigType extends AWS = AWS
> = {
  resourceParamsFactory: (id: TId, config: TConfigType) => TResourceParams;
  onResourceCreated?: (resource: Resource<CfnResourceProps>) => void;
  onFunctionCreated?: (lambda: ServerlessFunction) => void;
  hooks?: Hooks<TConfigType>;
};

export type PlaceholderProcessor<ConfigType> = (
  processContext: ProcessContext<ConfigType>
) => void;
