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
  CloudformResourceAdapter,
  FnSub,
  ResourceBuilder,
  Resources,
  ServerlessAWSFunction,
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
import { ResourceBase } from 'src';

export type PlaceholderProcessor<ConfigType> = (
  processContext: ProcessContext<ConfigType>
) => void;

type ResourceParamFactory<ResourceId, ConfigType, ResourceParams> = (
  id: ResourceId,
  config: ConfigType
) => ResourceParams;

class TypedServerless<
  ConfigType,
  ResourceId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
> {
  protected resourceParamsFactory: ResourceParamFactory<
    ResourceId,
    ConfigType,
    ResourceParams
  >;

  constructor({
    resourceParamsFactory,
  }: TypedServerlessParams<ConfigType, ResourceId, ResourceParams>) {
    this.resourceParamsFactory = resourceParamsFactory;
  }
  protected createResourcePlaceholder<T>(
    id: ResourceId,
    type: ResourceType,
    builder: ResourceBuilder<ResourceParams, T>
  ): T {
    return this.asPlaceholder(
      new ServerlessResourcePlaceholder(id, type, builder)
    );
  }

  protected addResources<T>(
    type: ResourceType,
    resources: Partial<Record<ResourceId, ResourceBuilder<ResourceParams, T>>>
  ): Resources<ResourceId, T> {
    return Object.keys(resources).reduce((out, id) => {
      out[id] = this.createResourcePlaceholder(
        id as ResourceId,
        type,
        resources[id]
      );
      return out;
    }, {} as Resources<ResourceId, T>);
  }

  resources<T>(
    resources: Partial<Record<ResourceId, ResourceBuilder<ResourceParams, T>>>
  ): Resources<ResourceId, CloudformResourceAdapter<T>> {
    return this.addResources('resource', resources) as Resources<ResourceId, CloudformResourceAdapter<T>>;
  }

  functions(
    functions: Partial<
      Record<ResourceId, (resource: ResourceParams) => ServerlessAWSFunction>
    >
  ): Resources<ResourceId, ServerlessAWSFunction> {
    return this.addResources('function', functions);
  }

  protected asPlaceholder<T>(placeholder: unknown): T {
    return placeholder as unknown as T;
  }

  refId(id: ResourceId): ResourceId {
    return new GetResourceLogicalId(id) as unknown as ResourceId;
  }

  ref<T>(id: ResourceId): T {
    return this.asPlaceholder(new CfRef(id));
  }

  getRef<T>(id: ResourceId): T {
    return this.ref(id);
  }

  arn<T>(id: ResourceId): T {
    return new CfRefAtt(id, 'Arn') as unknown as T;
  }

  getArn<T>(id: ResourceId): T {
    return this.arn(id);
  }

  getAtt<T>(id: ResourceId, attribute: string): T {
    return new CfRefAtt(id, attribute) as unknown as T;
  }

  getName<T>(id: ResourceId): T {
    return new GetResourceName(id) as unknown as T;
  }

  fnSub(content: string, params?: Record<string, unknown>): FnSub {
    if (!params) return { 'Fn::Sub': content };
    return { 'Fn::Sub': [content, params] };
  }

  buildLambdaArn(id: ResourceId) {
    return new BuildArn(lambdaArn(id));
  }
  buildBucketArn(id: ResourceId, path?: string) {
    return new BuildArn(bucketArn(id, path));
  }
  buildSnsArn(id: ResourceId) {
    return new BuildArn(snsArn(id));
  }
  buildEventBusArn(id: ResourceId) {
    return new BuildArn(eventBusArn(id));
  }
  buildSqsArn(id: ResourceId) {
    return new BuildArn(sqsArn(id));
  }
  /**
   * @deprecated Prefer #arn - AWS Step Function automatically adds a name suffix, because of that its not possible to build a correct Arn
   */
  buildStepFunctionArn(id: ResourceId) {
    return new BuildArn(stepFunctionArn(id));
  }
  buildAlarmArn(id: ResourceId) {
    return new BuildArn(alarmArn(id));
  }
  buildArn(id: ResourceId, params?: BuildArnParamsWithoutResourceId) {
    return new BuildArn<ResourceId>({ ...params, resourceId: id });
  }

  stringify<T>(content: unknown): T {
    return new CfStringify(content) as unknown as T;
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
        const params = this.resourceParamsFactory(id, config);
        trace('Resource', id, 'parameters:', params);
        // Register this resource name and type
        resourceNames[id] = params.name;
        resourceTypes[id] = type;
        // Invoke builder to create new data for this placeholder
        const newData = builder(params);
        trace('Resource', id, 'newData:', newData);
        // Replace placeholder with new data
        replaceValue(parent, key, path, newData);
        // stop visiting child properties, we do not support nested resources
        return false;
      }
      return true;
    });
  }

  protected requiresResource(
    targetId: ResourceId,
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

  protected processPlaceholders(processContext: ProcessContext<ConfigType>) {
    this.resourcePlaceholderProcessor(processContext);
    this.buildArnPlaceholderProcessor(processContext);
    this.referencePlaceholderProcessor(processContext);
    this.replaceStringifyPlaceholders(processContext);
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

type TypedServerlessParams<
  ConfigType,
  ResourceId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
> = {
  resourceParamsFactory: (id: ResourceId, config: ConfigType) => ResourceParams;
};

export function createTypedServerless<
  ConfigType,
  ResourceId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
>(params: TypedServerlessParams<ConfigType, ResourceId, ResourceParams>) {
  return new TypedServerless<ConfigType, ResourceId, ResourceParams>(params);
}
