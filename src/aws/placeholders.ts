import { ResourceBuilder } from './types';

export type ResourceType = 'resource' | 'function';

export class ServerlessResourcePlaceholder<ResourceId, ResourceParams, Output> {
  constructor(
    readonly id: ResourceId,
    readonly type: ResourceType,
    readonly builder: ResourceBuilder<ResourceParams, Output>
  ) {}
}
export class CfRef<ResourceId> {
  constructor(readonly id: ResourceId) {}
}

export class CfRefAtt<ResourceId> extends CfRef<ResourceId> {
  constructor(readonly id: ResourceId, readonly attribute: string) {
    super(id);
  }
}

export class GetResourceName<ResourceId> {
  constructor(readonly id: ResourceId) {}
}

export class GetResourceLogicalId<ResourceId> {
  constructor(readonly id: ResourceId) {}
}

export class CfStringify {
  constructor(readonly content: unknown) {}
}

/**
 * @link https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
 * Valid formats:
 * - 'arn:partition:service:region:account-id:resource-id'
 * - 'arn:partition:service:region:account-id:resource-type/resource-id'
 * - 'arn:partition:service:region:account-id:resource-type:resource-id'
 */
export class BuildArn<ResourceId> {
  constructor(
    readonly params: {
      partition?: string;
      service?: string;
      region?: string;
      namespace?: string;
      type?: string;
      resourceId: ResourceId;
      path?: string;
      typeToResourceSeparator?: ':' | '/';
    }
  ) {}
}
