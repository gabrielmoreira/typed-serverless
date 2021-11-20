import { AWS } from '@serverless/typescript';
import { ResourceBase } from 'cloudform-types';

export type ResourceBuilder<ResourceParams, T> = (
  resource: ResourceParams
) => T;
export type Resources<ResourceId extends string, T> = {
  [key in ResourceId]: T;
};

export type ServerlessAWSFunction = Exclude<
  AWS['functions'],
  undefined
>[string];

type AWSResources = Exclude<
  Exclude<AWS['resources'], undefined>['Resources'],
  undefined
>;

export type ServerlessAWSResource = Exclude<AWSResources, undefined>[string];

export type CloudformResourceAdapter<T> = T extends ResourceBase
  ? ServerlessAWSResource
  : T;

export type FnSub =
  | { 'Fn::Sub': string }
  | { 'Fn::Sub': [string, Record<string, unknown>] };
