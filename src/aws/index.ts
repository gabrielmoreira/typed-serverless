import {
  BuildArn,
  CfRef,
  CfRefAtt,
  CfStringify,
  GetResourceLogicalId,
  GetResourceName,
  ResourceType,
  ServerlessResourcePlaceholder,
} from './placeholders';
import { replaceValue } from '../utils/replaceValue';
import { debug, error, trace } from '../utils/logger';
import { traverseObject } from '../utils/traverseObject';
import { isCfIntrinsicFunction } from '../utils/isCfIntrinsicFunction';
import {
  Resource,
  FnSub,
  ResourceBuilder,
  Resources,
  ResourceProps,
  Functions,
  FunctionBuilder,
  ResourceAdapter,
  ServerlessFunction,
} from './types';
import { getServerlessAwsFunctionLogicalId } from './serverlessNaming';
import {
  alarmArn,
  bucketArn,
  buildArnFnSub,
  BuildArnParamsWithoutResourceId,
  eventBusArn,
  lambdaArn,
  snsArn,
  sqsArn,
  stepFunctionArn,
} from './arn';
import { Resolvable, CfnResourceProps } from 'typed-aws';

export type PlaceholderProcessor<ConfigType> = (
  processContext: ProcessContext<ConfigType>
) => void;

class TypedServerless<
  ConfigType,
  TId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
> {
  constructor(
    readonly params: TypedServerlessParams<ConfigType, TId, ResourceParams>
  ) {}

  protected createResourcePlaceholder<T extends ResourceProps>(
    id: TId,
    type: ResourceType,
    builder: ResourceBuilder<ResourceParams, T>
  ): T {
    return this.asPlaceholder(
      new ServerlessResourcePlaceholder(id, type, builder)
    );
  }

  protected addResources<
    TResourceId extends TId,
    TResource extends Resource<TResourceProps>,
    TResourceProps extends ResourceProps
  >(resources: {
    [key in TResourceId]: ResourceBuilder<ResourceParams, TResourceProps>;
  }): Resources<TResourceId, TResource, TResourceProps> {
    return Object.keys(resources).reduce((out, id) => {
      out[id] = this.createResourcePlaceholder(
        id as TResourceId,
        'resource',
        resources[id]
      );
      return out;
    }, {});
  }

  resources<
    TResourceId extends TId,
    TResource extends Resource<TResourceProps>,
    TResourceProps extends ResourceProps
  >(resources: {
    [key in TResourceId]: ResourceBuilder<ResourceParams, TResourceProps>;
  }) {
    return this.addResources(resources) as Resources<
      TResourceId,
      TResource,
      TResourceProps
    >;
  }

  resource<
    TResourceId extends TId,
    TResource extends Resource<TResourceProps>,
    TResourceProps extends ResourceProps
  >(resource: {
    [key in TResourceId]: ResourceBuilder<
      ResourceParams,
      ResourceAdapter<TResource, TResourceProps>
    >;
  }) {
    return this.resources(resource);
  }

  functions<
    TFunctionId extends TId,
    TFunctionBuilderParams extends ResourceParams
  >(functions: {
    [K in TFunctionId]?: FunctionBuilder<TFunctionBuilderParams>;
  }): Functions<TFunctionId> {
    return Object.keys(functions).reduce((out, id) => {
      out[id] = this.createResourcePlaceholder(
        id as TFunctionId,
        'function',
        functions[id]
      );
      return out;
    }, {} as Functions<TFunctionId>);
  }

  protected asPlaceholder<T>(placeholder: unknown): T {
    return placeholder as unknown as T;
  }

  refId(id: TId): TId {
    return new GetResourceLogicalId(id) as unknown as TId;
  }

  ref<T>(id: TId): T {
    return this.asPlaceholder(new CfRef(id));
  }

  getRef<T>(id: TId): T {
    return this.ref(id);
  }

  arn<T>(id: TId): T {
    return new CfRefAtt(id, 'Arn') as unknown as T;
  }

  getArn<T>(id: TId): T {
    return this.arn(id);
  }

  getAtt<T>(id: TId, attribute: string): T {
    return new CfRefAtt(id, attribute) as unknown as T;
  }

  getName<T>(id: TId): T {
    return new GetResourceName(id) as unknown as T;
  }

  fnSub(content: string, params?: Record<string, unknown>): FnSub {
    if (!params) return { 'Fn::Sub': content };
    return { 'Fn::Sub': [content, params] };
  }

  buildLambdaArn(id: TId) {
    return new BuildArn(lambdaArn(id));
  }
  buildBucketArn(id: TId, path?: string) {
    return new BuildArn(bucketArn(id, path));
  }
  buildSnsArn(id: TId) {
    return new BuildArn(snsArn(id));
  }
  buildEventBusArn(id: TId) {
    return new BuildArn(eventBusArn(id));
  }
  buildSqsArn(id: TId) {
    return new BuildArn(sqsArn(id));
  }
  /**
   * @deprecated Prefer #arn - AWS Step Function automatically adds a name suffix, because of that its not possible to build a correct Arn
   */
  buildStepFunctionArn(id: TId) {
    return new BuildArn(stepFunctionArn(id));
  }
  buildAlarmArn(id: TId) {
    return new BuildArn(alarmArn(id));
  }
  buildArn(id: TId, params?: BuildArnParamsWithoutResourceId) {
    return new BuildArn<TId>({ ...params, resourceId: id });
  }

  /**
   * The main use case for this is to overcome a limitation in CloudFormation that
   * does not allow using intrinsic functions as dictionary keys (because
   * dictionary keys in JSON must be strings). Specifically this is common in IAM
   * conditions such as `StringEquals: { lhs: "rhs" }` where you want "lhs" to be
   * a reference.
   */
  stringify<T>(content: unknown): T {
    return new CfStringify(content) as unknown as T;
  }

  cfn<T>(expression: Resolvable<string>): T {
    return expression as T;
  }

  protected resourcePlaceholderProcessor({
    config,
    resourceNames,
    resourceTypes,
  }) {
    // deep traverse our config to find and resource placeholders
    traverseObject(config, (node, parent, key, path) => {
      if (node instanceof ServerlessResourcePlaceholder) {
        const { id, type, builder } = node;
        debug('Registering resource', id);
        const params = this.params.resourceParamsFactory(id, config);
        trace('Creating', type, id, 'parameters:', params);
        // Register this resource name and type
        resourceNames[id] = params.name;
        resourceTypes[id] = type;
        // Invoke builder to create new data for this placeholder
        const object = builder(params);
        trace('Created', type, id, 'object:', object);
        // Replace placeholder with new data
        replaceValue(parent, key, path, object);
        if (type === 'resource') {
          this.params?.onResourceCreated?.(object);
        } else if (type === 'function') {
          this.params?.onFunctionCreated?.(object as ServerlessFunction);
        }
        // stop visiting child properties, we do not support nested resources
        return false;
      }
      return true;
    });
  }

  protected requiresResource(
    targetId: TId,
    sourcePath: string[],
    { errors, resourceNames, resourceTypes }: ProcessContext<ConfigType>
  ) {
    // validate if it's pointing to a registered resource...
    const name = resourceNames[targetId];
    if (!name) {
      const message = `Referenced resource '${targetId}' not found! Check your configuration at '${sourcePath.join(
        '.'
      )}'`;
      error(message);
      errors.push(message);
      return null;
    }
    const logicalId =
      resourceTypes[targetId] === 'function'
        ? getServerlessAwsFunctionLogicalId(targetId)
        : targetId;
    return { logicalId, name };
  }

  protected buildArnPlaceholderProcessor(
    processContext: ProcessContext<ConfigType>
  ) {
    // deep traverse our config to find and replace placeholders
    traverseObject(processContext.config, (node, parent, key, path) => {
      // if its a reference replaceholder...
      if (node instanceof BuildArn) {
        const id = node.params.resourceId;
        const resource = this.requiresResource(id, path, processContext);
        if (!resource) return true;
        // replace our placeholder with a real content...
        const arn = buildArnFnSub({
          ...node.params,
          resourceId: resource.name,
        });
        replaceValue(parent, key, path, arn);
      }
      // continue visiting all child nodes
      return true;
    });
  }

  protected referencePlaceholderProcessor(
    processContext: ProcessContext<ConfigType>
  ) {
    // deep traverse our config to find and replace placeholders
    traverseObject(processContext.config, (node, parent, key, path) => {
      // if its a reference replaceholder...
      if (
        node instanceof GetResourceName ||
        node instanceof CfRefAtt ||
        node instanceof CfRef ||
        node instanceof GetResourceLogicalId
      ) {
        const resource = this.requiresResource(node.id, path, processContext);
        if (!resource) return true;
        // replace our placeholder with a real content...
        if (node instanceof GetResourceName) {
          replaceValue(parent, key, path, resource.name);
        } else if (node instanceof CfRefAtt) {
          const data = { 'Fn::GetAtt': [resource.logicalId, node.attribute] };
          replaceValue(parent, key, path, data);
        } else if (node instanceof CfRef) {
          const data = { Ref: resource.logicalId };
          replaceValue(parent, key, path, data);
        } else if (node instanceof GetResourceLogicalId) {
          replaceValue(parent, key, path, resource.logicalId);
        }
      }
      // continue visiting all child nodes
      return true;
    });
  }

  protected replaceStringifyPlaceholders({
    config,
  }: ProcessContext<ConfigType>) {
    // deep traverse our config to find and replace placeholders
    traverseObject(config, (node, parent, key, path) => {
      if (node instanceof CfStringify) {
        // extract cloudformation expressions as parameters
        const extractedParams = {};

        // traverse all CloudFormation expressions Fn::* or Ref
        traverseObject(node, (childNode, parent, key, path) => {
          if (isCfIntrinsicFunction(childNode)) {
            const paramName = `extracted_param_${
              Object.keys(extractedParams).length
            }`;
            extractedParams[paramName] = childNode;
            replaceValue(parent, key, path, '${' + paramName + '}');
            return false;
          }
          return true;
        });

        // Stringify content and replace with Fn::Sub [content, extractedParams]
        replaceValue(parent, key, path, {
          'Fn::Sub': [JSON.stringify(node.content), extractedParams],
        });
      }
      return true;
    });
  }

  protected processHook(
    hookPhase: HookPhase,
    processContext: ProcessContext<ConfigType>
  ) {
    this.params.hooks?.[hookPhase]?.(processContext);
  }

  protected processPlaceholders(processContext: ProcessContext<ConfigType>) {
    // Replace Resource Placeholders
    this.processHook('before-resource', processContext);
    this.resourcePlaceholderProcessor(processContext);
    this.processHook('after-resource', processContext);

    // Replace BuildArn Placeholders
    this.buildArnPlaceholderProcessor(processContext);

    // Replace Reference Placeholders
    this.processHook('before-reference', processContext);
    this.referencePlaceholderProcessor(processContext);
    this.processHook('after-reference', processContext);

    // Replace Stringify Placeholders
    this.processHook('before-stringify', processContext);
    this.replaceStringifyPlaceholders(processContext);
    this.processHook('after-stringify', processContext);
  }

  process(config: ConfigType) {
    const processContext: ProcessContext<ConfigType> = {
      config,
      errors: [],
      resourceNames: {},
      resourceTypes: {},
    };
    this.processPlaceholders(processContext);
    return processContext;
  }

  build(rawConfig: ConfigType) {
    const { config, errors } = this.process(rawConfig);
    if (errors.length) {
      throw Object.assign(
        new Error(`Validation errors!\n\t${errors.join('\n\t')}`),
        { errors, config }
      );
    }
    return config;
  }
}

export type ProcessContext<T> = {
  config: T;
  resourceNames: Record<string, string>;
  resourceTypes: Record<string, ResourceType>;
  errors: string[];
};

export type BaseResourceParams = {
  name: string;
};

type HookPhase =
  | 'before-resource'
  | 'after-resource'
  | 'before-reference'
  | 'after-reference'
  | 'before-stringify'
  | 'after-stringify';

type HookProcessor<TConfigType> = (
  context: ProcessContext<TConfigType>
) => void;
type Hooks<TConfigType> = {
  [key in HookPhase]?: HookProcessor<TConfigType>;
};

type TypedServerlessParams<
  TConfigType,
  TId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
> = {
  resourceParamsFactory: (id: TId, config: TConfigType) => ResourceParams;
  onResourceCreated?: (resource: Resource<CfnResourceProps>) => void;
  onFunctionCreated?: (lambda: ServerlessFunction) => void;
  hooks?: Hooks<TConfigType>;
};

export function createTypedServerless<
  TConfigType,
  TId extends string = string,
  TResourceParams extends BaseResourceParams = BaseResourceParams
>(params: TypedServerlessParams<TConfigType, TId, TResourceParams>) {
  return new TypedServerless<TConfigType, TId, TResourceParams>(params);
}
