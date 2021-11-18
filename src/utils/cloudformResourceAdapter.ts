import { ResourceBase } from "cloudform-types/types/resource";

export type CloudformResourceAdapter<T> = T extends ResourceBase ? AwsResource : T;
export type AwsResourceCondition = string;
export type AwsResourceDependsOn = string[];
export type AwsResource = {
  Type: string;
  Properties?: {
    [k: string]: unknown;
  };
  CreationPolicy?: {
    [k: string]: unknown;
  };
  DeletionPolicy?: string;
  DependsOn?: AwsResourceDependsOn;
  Metadata?: {
    [k: string]: unknown;
  };
  UpdatePolicy?: {
    [k: string]: unknown;
  };
  UpdateReplacePolicy?: string;
  Condition?: AwsResourceCondition;
};
