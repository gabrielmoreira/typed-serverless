import { AWS } from '@serverless/typescript';
import { Resolvable } from 'typed-aws';
import { getServerlessStage } from '../utils/serverless';
import { BaseResourceParams, TypedServerlessParams } from './types';

export type AwsTag = {
  Key: Resolvable<string>;
  Value: Resolvable<string>;
};

export type DefaultResourceParams = BaseResourceParams & {
  tags?: Record<string, string>;
  awsTags?: AwsTag[];
};

export function defaultResourceParamsFactory<
  TId extends string = string,
  TConfigType extends AWS = AWS
>(id: TId, config: TConfigType): DefaultResourceParams {
  return {
    // resourceParamsFactory function will be invoked BEFORE each resource created with
    // typed.resources('id', (Params) => SQS.Queue({ Name: Params.name }))
    // where Params will be the result of the following function execution:
    name: `${config.service}-${getServerlessStage()}-${id}`,
    // Pass tags to all resources
    tags: config.provider.tags,
    // Transform tags {key: value}, to Array<{Key: string, Value: string}>
    awsTags:
      config.provider.tags &&
      Object.entries(config.provider.tags).map((it) => ({
        Key: it[0],
        Value: it[1],
      })),
  };
}

export function defaultTypedServerlessParams<
  TId extends string = string
>(): TypedServerlessParams<TId, DefaultResourceParams> {
  return {
    resourceParamsFactory: defaultResourceParamsFactory,
  };
}
