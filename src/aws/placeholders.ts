export class ServerlessResource<ResourceId, ResourceParams, Output> {
  id: ResourceId;
  builder: (params: ResourceParams) => Output;
  constructor(id: ResourceId, builder: (params: ResourceParams) => Output) {
    this.id = id;
    this.builder = builder;
  }
}

export class CfRef<ResourceId> {
  id: ResourceId;
  constructor(id: ResourceId) {
    this.id = id;
  }
}

export class CfRefAtt<ResourceId> extends CfRef<ResourceId> {
  attribute: string;
  constructor(id: ResourceId, attribute: string) {
    super(id);
    this.attribute = attribute;
  }
}

export class GetResourceName<ResourceId> {
  id: ResourceId;
  constructor(id: ResourceId) {
    this.id = id;
  }
}

export class CfStringify {
  content: unknown;
  constructor(content: unknown) {
    this.content = content;
  }
}