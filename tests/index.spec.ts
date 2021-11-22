import { AWS } from '@serverless/typescript';
import {
  TypedServerless,
  SQS,
  S3,
  CfnResource,
  CfnResourceProps,
} from '../src';
import { CfRef } from '../src/aws/placeholders';

const defaultParams = {
  resourceParamsFactory: (id: string) => {
    return { name: `my-custom-name-${id}` };
  },
};

describe('createTypedServerless', () => {
  it('should build and replace resources', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: s.resources({
        'id-1': ({ name }) =>
          SQS.Queue({
            QueueName: name,
          })
            .dependsOn(s.refId('id-4'))
            .dependsOn(s.refId('id-3')),
      }),
      multipleResources: s.resources({
        'id-3': ({ name }) => fakeResource({ properties: { name } }),
        'id-4': ({ name }) => fakeResource({ properties: { name } }),
      }),
      any: {
        deep: [
          {
            location: s.resources({
              'id-2': ({ name }) =>
                fakeResource({
                  somethingElse: 123,
                  name,
                }),
            }),
          },
        ],
      },
    };
    // When
    const finalConfig = clone(s.build(myConfig as unknown as AWS));
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          Type: 'AWS::SQS::Queue',
          Properties: {
            QueueName: 'my-custom-name-id-1',
          },
          DependsOn: ['id-4', 'id-3'],
        },
      },
      multipleResources: {
        'id-3': {
          properties: { name: 'my-custom-name-id-3' },
        },
        'id-4': {
          properties: { name: 'my-custom-name-id-4' },
        },
      },
      any: {
        deep: [
          {
            location: {
              'id-2': {
                name: 'my-custom-name-id-2',
                somethingElse: 123,
              },
            },
          },
        ],
      },
    });
  });
  it('should be able to reference a resource', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resources({
          'id-1': ({ name }) =>
            fakeResource({
              myCustomObject: { name },
            }),
        }),
        ...s.resources({
          'id-2': ({ name }) =>
            fakeResource({
              myCustomObject: { name },
            }),
        }),
      },
      functions: s.functions({
        'id-3': ({ name }) => ({
          name,
          handler: 'index.handler',
        }),
      }),
      resourceRefs: {
        logicalRef: s.ref('id-1'),
        arnRef: s.getArn('id-1'),
        nameRef: s.getName('id-1'),
        attRef: s.getAtt('id-1', 'url'),
        nestedRef: s.getAtt('id-1', s.getAtt('id-2', 'url')),
      },
      functionRefs: {
        logicalRef: s.ref('id-3'),
        arnRef: s.getArn('id-3'),
        nameRef: s.getName('id-3'),
        attRef: s.getAtt('id-3', 'Arn'),
        nestedRef: s.getAtt('id-3', s.getAtt('id-3', 'Arn')),
      },
    };
    // When
    const finalConfig = clone(s.build(myConfig as unknown as AWS));
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
        },
        'id-2': {
          myCustomObject: {
            name: 'my-custom-name-id-2',
          },
        },
      },
      resourceRefs: {
        logicalRef: {
          Ref: 'id-1',
        },
        arnRef: {
          'Fn::GetAtt': ['id-1', 'Arn'],
        },
        attRef: {
          'Fn::GetAtt': ['id-1', 'url'],
        },
        nameRef: 'my-custom-name-id-1',
        nestedRef: {
          'Fn::GetAtt': [
            'id-1',
            {
              'Fn::GetAtt': ['id-2', 'url'],
            },
          ],
        },
      },
      functionRefs: {
        arnRef: {
          'Fn::GetAtt': ['IdDash3LambdaFunction', 'Arn'],
        },
        attRef: {
          'Fn::GetAtt': ['IdDash3LambdaFunction', 'Arn'],
        },
        logicalRef: {
          Ref: 'IdDash3LambdaFunction',
        },
        nameRef: 'my-custom-name-id-3',
        nestedRef: {
          'Fn::GetAtt': [
            'IdDash3LambdaFunction',
            {
              'Fn::GetAtt': ['IdDash3LambdaFunction', 'Arn'],
            },
          ],
        },
      },
      functions: {
        'id-3': {
          handler: 'index.handler',
          name: 'my-custom-name-id-3',
        },
      },
    });
  });
  it('should fail if you reference an invalid resource', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: s.resources({
        'id-1': ({ name }) =>
          fakeResource({
            myCustomObject: { name },
          }),
      }),
      any: {
        logicalRef: s.ref('id-2'),
        arnRef: s.getArn('id-2'),
        nameRef: s.getName('id-2'),
        attRef: s.getAtt('id-2', 'url'),
      },
    };
    // When
    expect(() => s.build(myConfig as unknown as AWS)).toThrow('Validation errors!');
    const result = s.process(myConfig as unknown as AWS);
    // Then
    expect(result.errors).toStrictEqual([
      "Referenced resource 'id-2' not found! Check your configuration at 'any.logicalRef'",
      "Referenced resource 'id-2' not found! Check your configuration at 'any.arnRef'",
      "Referenced resource 'id-2' not found! Check your configuration at 'any.nameRef'",
      "Referenced resource 'id-2' not found! Check your configuration at 'any.attRef'",
    ]);
    expect(result.config).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
        },
      },
      any: {
        logicalRef: new CfRef('id-2'),
        arnRef: s.getArn('id-2'),
        nameRef: s.getName('id-2'),
        attRef: s.getAtt('id-2', 'url'),
      },
    });
  });
  it('should be able to extract any CF intrinsic function to parameter substitution before "stringify" an object', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: s.resources({
        'id-1': ({ name }) =>
          fakeResource({
            myCustomObject: { name },
          }),
      }),
      myObject: s.stringify({
        any: {
          logicalRef: s.ref('id-1'),
          arnRef: s.getArn('id-1'),
          nameRef: s.getName('id-1'),
          attRef: s.getAtt('id-1', 'url'),
          customSub: s.fnSub('my name is ${name}', { name: 'Gabriel' }),
          customSub2: s.fnSub('aws account id is ${AWS::AccountId}'),
          transform: {
            'Fn::Transform': {
              Name: 'AWS::Include',
              Parameters: {
                Location: { Ref: 'InputValue' },
              },
            },
          },
          sub: {
            'Fn::Sub': ['www.${Domain}', { Domain: { Ref: 'RootDomainName' } }],
          },
        },
      }),
    };
    // When
    const finalConfig = s.build(myConfig as unknown as AWS);
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
        },
      },
      myObject: {
        'Fn::Sub': [
          JSON.stringify({
            any: {
              logicalRef: '${extracted_param_0}',
              arnRef: '${extracted_param_1}',
              nameRef: 'my-custom-name-id-1',
              attRef: '${extracted_param_2}',
              customSub: '${extracted_param_3}',
              customSub2: '${extracted_param_4}',
              transform: '${extracted_param_5}',
              sub: '${extracted_param_6}',
            },
          }),
          {
            extracted_param_0: {
              Ref: 'id-1',
            },
            extracted_param_1: {
              'Fn::GetAtt': ['id-1', 'Arn'],
            },
            extracted_param_2: {
              'Fn::GetAtt': ['id-1', 'url'],
            },
            extracted_param_3: {
              'Fn::Sub': [
                'my name is ${name}',
                {
                  name: 'Gabriel',
                },
              ],
            },
            extracted_param_4: {
              'Fn::Sub': 'aws account id is ${AWS::AccountId}',
            },
            extracted_param_5: {
              'Fn::Transform': {
                Name: 'AWS::Include',
                Parameters: {
                  Location: {
                    Ref: 'InputValue',
                  },
                },
              },
            },
            extracted_param_6: {
              'Fn::Sub': [
                'www.${Domain}',
                {
                  Domain: {
                    Ref: 'RootDomainName',
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });
  it('support typescript type checking for ids', () => {
    // Given
    type ValidIds = 'id-1' | 'id-2';
    const s = TypedServerless.create<ValidIds>(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resources({
          'id-1': ({ name }) =>
            fakeResource({
              myCustomObject: { name },
            }),
        }),
        ...s.resources({
          'id-2': ({ name }) =>
            fakeResource({
              myCustomObject: { name },
            }),
        }),
      },
      myObject: {
        any: {
          logicalRef: s.ref('id-1'),
          arnRef: s.getArn('id-1'),
          nameRef: s.getName('id-2'),
          attRef: s.getAtt('id-2', 'url'),
        },
      },
    };
    // When
    const finalConfig = s.build(myConfig as unknown as AWS);
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
        },
        'id-2': {
          myCustomObject: {
            name: 'my-custom-name-id-2',
          },
        },
      },
      myObject: {
        any: {
          arnRef: {
            'Fn::GetAtt': ['id-1', 'Arn'],
          },
          attRef: {
            'Fn::GetAtt': ['id-2', 'url'],
          },
          logicalRef: {
            Ref: 'id-1',
          },
          nameRef: 'my-custom-name-id-2',
        },
      },
    });
  });
  it('support creating extra resource data', () => {
    // Given
    type ValidIds = 'secret-id-1' | 'queue-id-2';
    type ResourceParamsWithTags = {
      name: string;
      tags: Record<string, number | string>;
    };
    const service = 'testing';
    const stage = 'dev';
    const s = TypedServerless.create<ValidIds, ResourceParamsWithTags>({
      resourceParamsFactory: (id) => {
        const [type, ...names] = id.split('-');
        const name = names.join('-');
        const tags = { type, id };
        const T = type === 'secret' ? '/' : '-';
        return { name: `${service}${T}${stage}${T}${name}`, tags };
      },
    });
    const myConfig = {
      myResources: {
        ...s.resources({
          'secret-id-1': ({ name, tags }) =>
            fakeResource({
              myCustomObject: { name, tags },
            }),
        }),
        ...s.resources({
          'queue-id-2': ({ name, tags }) =>
            fakeResource({
              myCustomObject: { name, tags },
            }),
        }),
      },
      myObject: {
        any: {
          logicalRef: s.ref('secret-id-1'),
          arnRef: s.getArn('secret-id-1'),
          nameRef: s.getName('queue-id-2'),
          attRef: s.getAtt('queue-id-2', 'url'),
        },
      },
    };
    // When
    const finalConfig = s.build(myConfig as unknown as AWS);
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'secret-id-1': {
          myCustomObject: {
            name: 'testing/dev/id-1',
            tags: { type: 'secret', id: 'secret-id-1' },
          },
        },
        'queue-id-2': {
          myCustomObject: {
            name: 'testing-dev-id-2',
            tags: { type: 'queue', id: 'queue-id-2' },
          },
        },
      },
      myObject: {
        any: {
          arnRef: {
            'Fn::GetAtt': ['secret-id-1', 'Arn'],
          },
          attRef: {
            'Fn::GetAtt': ['queue-id-2', 'url'],
          },
          logicalRef: {
            Ref: 'secret-id-1',
          },
          nameRef: 'testing-dev-id-2',
        },
      },
    });
  });
  it('should support cloudform-types', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resources({
          'my-queue': ({ name }) =>
            SQS.Queue({
              QueueName: name,
            }),
        }),
        ...s.resources({
          'my-bucket': () =>
            S3.Bucket({
              BucketName: 'my-bucket-fixed-name',
            }),
        }),
      },
    };
    // When
    const finalConfig = JSON.parse(JSON.stringify(s.build(myConfig as unknown as AWS)));
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'my-bucket': {
          Properties: {
            BucketName: 'my-bucket-fixed-name',
          },
          Type: 'AWS::S3::Bucket',
        },
        'my-queue': {
          Properties: {
            QueueName: 'my-custom-name-my-queue',
          },
          Type: 'AWS::SQS::Queue',
        },
      },
    });
  });
  it('should be able to build arn for a resource', () => {
    // Given
    const s = TypedServerless.create(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resources({
          'id-1': ({ name }) =>
            fakeResource({
              myCustomObject: { name },
            }),
        }),
      },
      functions: s.functions({
        'id-2': ({ name }) => ({
          name,
          handler: 'index.handler',
        }),
      }),
      any: {
        buildAlarmArn: s.buildAlarmArn('id-1'),
        buildBucketArn: s.buildBucketArn('id-1', '/some-path'),
        buildEventBusArn: s.buildEventBusArn('id-1'),
        buildFakeLambdaArn: s.buildLambdaArn('id-1'),
        buildLambdaArn: s.buildLambdaArn('id-2'),
        buildSnsArn: s.buildSnsArn('id-1'),
        buildSqsArn: s.buildSqsArn('id-1'),
        buildStepFunctionArn: s.buildStepFunctionArn('id-1'),
      },
    };
    // When
    const finalConfig = s.build(myConfig as unknown as AWS);
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
        },
      },
      functions: {
        'id-2': {
          handler: 'index.handler',
          name: 'my-custom-name-id-2',
        },
      },
      any: {
        buildAlarmArn: {
          'Fn::Sub':
            'arn:aws:cloudwatch:${AWS::Region}:${AWS::AccountId}:alarm:my-custom-name-id-1',
        },
        buildBucketArn: {
          'Fn::Sub': 'arn:aws:s3:::my-custom-name-id-1/some-path',
        },
        buildEventBusArn: {
          'Fn::Sub':
            'arn:aws:events:${AWS::Region}:${AWS::AccountId}:event-bus/my-custom-name-id-1',
        },
        buildFakeLambdaArn: {
          'Fn::Sub':
            'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:my-custom-name-id-1',
        },
        buildLambdaArn: {
          'Fn::Sub':
            'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:my-custom-name-id-2',
        },
        buildSnsArn: {
          'Fn::Sub':
            'arn:aws:sns:${AWS::Region}:${AWS::AccountId}:my-custom-name-id-1',
        },
        buildSqsArn: {
          'Fn::Sub':
            'arn:aws:sqs:${AWS::Region}:${AWS::AccountId}:my-custom-name-id-1',
        },
        buildStepFunctionArn: {
          'Fn::Sub':
            'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:my-custom-name-id-1',
        },
      },
    });
  });
});

function clone<T>(config: T): T {
  return JSON.parse(JSON.stringify(config));
}

function fakeResource<T extends CfnResourceProps>(props: T): CfnResource<T> {
  return props as unknown as CfnResource<T>;
}
