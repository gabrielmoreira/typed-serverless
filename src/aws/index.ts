import {
  CfRef,
  CfRefAtt,
  CfStringify,
  GetResourceName,
  ServerlessResource,
} from './placeholders';
import { replaceValue } from '../utils/replaceValue';
import { debug, error, trace } from '../utils/logger';
import { traverseObject } from '../utils/traverseObject';
import { isCfIntrinsicFunction } from '../utils/isCfIntrinsicFunction';
import { CloudformResourceAdapter } from '../utils/cloudformResourceAdapter';

type FnSub =
  | { 'Fn::Sub': string }
  | { 'Fn::Sub': [string, Record<string, unknown>] };

class TypedServerless<
  ConfigType,
  ResourceId extends string = string,
  ResourceParams extends BaseResourceParams = BaseResourceParams
> {
  resourceParamsFactory: (id: ResourceId, config: ConfigType) => ResourceParams;

  constructor({
    resourceParamsFactory,
  }: TypedServerlessParams<ConfigType, ResourceId, ResourceParams>) {
    this.resourceParamsFactory = resourceParamsFactory;
  }

  protected replaceResourcePlaceholders({ config, resourceNames }) {
    // deep traverse our config to find and replace placeholders
    traverseObject(config, (node, parent, key, path) => {
      if (node instanceof ServerlessResource) {
        debug('Registering resource', node.id);
        const params = this.resourceParamsFactory(node.id, config);
        trace('Resource', node.id, 'parameters:', params);
        resourceNames[node.id] = params.name;
        const data = node.builder(params);
        trace('Resource', node.id, 'data:', data);
        replaceValue(parent, key, path, data);
        // stop visiting child properties, we do not support nested resources
        return false;
      }
      // continue visiting all child nodes
      return true;
    });
  }

  protected replaceReferencePlaceholders({ config, resourceNames, errors }) {
    // deep traverse our config to find and replace placeholders
    traverseObject(config, (node, parent, key, path) => {
      // if its a reference replaceholder...
      if (
        node instanceof GetResourceName ||
        node instanceof CfRef ||
        node instanceof CfRefAtt
      ) {
        // validate if it's pointing to a registered resource...
        const name = resourceNames[node.id];
        if (!name) {
          const message = `Referenced resource '${
            node.id
          }' not found! Check your configuration at '${path.join('.')}'`;
          error(message);
          errors.push(message);
          return true;
        }
        // replace our placeholder with a real content...
        if (node instanceof GetResourceName) {
          replaceValue(parent, key, path, name);
        } else if (node instanceof CfRefAtt) {
          const data = { 'Fn::GetAtt': [node.id, node.attribute] };
          replaceValue(parent, key, path, data);
        } else if (node instanceof CfRef) {
          const data = { Ref: node.id };
          replaceValue(parent, key, path, data);
        }
      }
      // continue visiting all child nodes
      return true;
    });
  }

  protected replaceStringifyPlaceholders({ config }) {
    // deep traverse our config to find and replace placeholders
    traverseObject(config, (node, parent, key, path) => {
      if (node instanceof CfStringify) {
        // extract cloudformation expressions as parameters
        const extractedParams = {};

        // traverse all CloudFormation expressions Fn::* or Ref
        traverseObject(node, (childNode, parent, key, path) => {
          if (isCfIntrinsicFunction(childNode)) {
            const paramName = `extractParam_${
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

  resource<T>(
    id: ResourceId,
    builder: (resource: ResourceParams) => T
  ): { [key in ResourceId]: CloudformResourceAdapter<T> } {
    const resource = new ServerlessResource<ResourceId, ResourceParams, T>(
      id,
      builder
    );
    return { [id]: resource } as unknown as {
      [key in ResourceId]: CloudformResourceAdapter<T>;
    };
  }

  ref<T>(id: ResourceId): T {
    return new CfRef(id) as unknown as T;
  }

  getArn<T>(id: ResourceId): T {
    return new CfRefAtt(id, 'Arn') as unknown as T;
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

  stringify<T>(content: unknown): T {
    return new CfStringify(content) as unknown as T;
  }

  build(config: ConfigType, options?: { noFailOnError: boolean }) {
    const processContext: ProcessContext<ConfigType> = {
      config,
      errors: [],
      resourceNames: {},
    };

    this.replaceResourcePlaceholders(processContext);
    this.replaceReferencePlaceholders(processContext);
    this.replaceStringifyPlaceholders(processContext);

    const { errors } = processContext;

    const shouldThrowErrors = !options?.noFailOnError;
    if (shouldThrowErrors && errors.length) {
      throw Object.assign(
        new Error(`Validation errors!\n\t${errors.join('\n\t')}`),
        { errors, config }
      );
    }
    return { config, errors };
  }
}

type ProcessContext<T> = {
  config: T;
  resourceNames: Record<string, string>;
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
