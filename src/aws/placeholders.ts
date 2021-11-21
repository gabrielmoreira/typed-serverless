import { ResourceBuilder, ResourceProps } from './types';

export type ResourceType = 'resource' | 'function';

export class ServerlessResourcePlaceholder<
  TResourceId,
  TResourceParams,
  TResourceProps extends ResourceProps
> {
  constructor(
    readonly id: TResourceId,
    readonly type: ResourceType,
    readonly builder: ResourceBuilder<TResourceParams, TResourceProps>
  ) {}
}
export class CfRef<TResourceId> {
  constructor(readonly id: TResourceId) {}
}

export class CfRefAtt<TResourceId> extends CfRef<TResourceId> {
  constructor(readonly id: TResourceId, readonly attribute: string) {
    super(id);
  }
}

export class GetResourceName<TResourceId> {
  constructor(readonly id: TResourceId) {}
}

export class GetResourceLogicalId<TResourceId> {
  constructor(readonly id: TResourceId) {}
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
export class BuildArn<TResourceId> {
  constructor(
    readonly params: {
      partition?: string;
      service?: string;
      region?: string;
      namespace?: string;
      type?: string;
      resourceId: TResourceId;
      path?: string;
      typeToResourceSeparator?: ':' | '/';
    }
  ) {}
}
