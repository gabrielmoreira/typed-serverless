import { createTypedServerless, SQS, S3 } from '../src';

const defaultParams = {
  resourceParamsFactory: (id: string): { name: string } => {
    return { name: `my-custom-name-${id}` };
  },
};

describe('createTypedServerless', () => {
  it('should build and replace resources', () => {
    // Given
    const s = createTypedServerless(defaultParams);
    const myConfig = {
      myResources: s.resource('id-1', ({ name }) => ({
        myCustomObject: { name },
      })),
      any: {
        deep: [
          {
            location: s.resource('id-2', ({ name }) => ({
              somethingElse: 123,
              name,
            })),
          },
        ],
      },
    };
    // When
    const finalConfig = s.build(myConfig).config;
    // Then
    expect(finalConfig).toStrictEqual({
      myResources: {
        'id-1': {
          myCustomObject: {
            name: 'my-custom-name-id-1',
          },
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
    const s = createTypedServerless(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resource('id-1', ({ name }) => ({
          myCustomObject: { name },
        })),
        ...s.resource('id-2', ({ name }) => ({
          myCustomObject: { name },
        })),
      },
      any: {
        logicalRef: s.ref('id-1'),
        arnRef: s.getArn('id-1'),
        nameRef: s.getName('id-1'),
        attRef: s.getAtt('id-1', 'url'),
        nestedRef: s.getAtt('id-1', s.getAtt('id-2', 'url')),
      },
    };
    // When
    const finalConfig = s.build(myConfig).config;
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

      any: {
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
    });
  });
  it('should fail if you reference an invalid resource', () => {
    // Given
    const s = createTypedServerless(defaultParams);
    const myConfig = {
      myResources: s.resource('id-1', ({ name }) => ({
        myCustomObject: { name },
      })),
      any: {
        logicalRef: s.ref('id-2'),
        arnRef: s.getArn('id-2'),
        nameRef: s.getName('id-2'),
        attRef: s.getAtt('id-2', 'url'),
      },
    };
    // When
    expect(() => s.build(myConfig)).toThrow('Validation errors!');
    const result = s.build(myConfig, { noFailOnError: true });
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
        logicalRef: s.ref('id-2'),
        arnRef: s.getArn('id-2'),
        nameRef: s.getName('id-2'),
        attRef: s.getAtt('id-2', 'url'),
      },
    });
  });
  it('should be able to extract any CF intrinsic function to parameter substitution before "stringify" an object', () => {
    // Given
    const s = createTypedServerless(defaultParams);
    const myConfig = {
      myResources: s.resource('id-1', ({ name }) => ({
        myCustomObject: { name },
      })),
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
    const finalConfig = s.build(myConfig).config;
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
              logicalRef: '${extractParam_0}',
              arnRef: '${extractParam_1}',
              nameRef: 'my-custom-name-id-1',
              attRef: '${extractParam_2}',
              customSub: '${extractParam_3}',
              customSub2: '${extractParam_4}',
              transform: '${extractParam_5}',
              sub: '${extractParam_6}',
            },
          }),
          {
            extractParam_0: {
              Ref: 'id-1',
            },
            extractParam_1: {
              'Fn::GetAtt': ['id-1', 'Arn'],
            },
            extractParam_2: {
              'Fn::GetAtt': ['id-1', 'url'],
            },
            extractParam_3: {
              'Fn::Sub': [
                'my name is ${name}',
                {
                  name: 'Gabriel',
                },
              ],
            },
            extractParam_4: {
              'Fn::Sub': 'aws account id is ${AWS::AccountId}',
            },
            extractParam_5: {
              'Fn::Transform': {
                Name: 'AWS::Include',
                Parameters: {
                  Location: {
                    Ref: 'InputValue',
                  },
                },
              },
            },
            extractParam_6: {
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
    const s = createTypedServerless<unknown, ValidIds>({
      resourceParamsFactory: (id) => {
        return { name: `my-custom-name-${id}` };
      },
    });
    const myConfig = {
      myResources: {
        ...s.resource('id-1', ({ name }) => ({
          myCustomObject: { name },
        })),
        ...s.resource('id-2', ({ name }) => ({
          myCustomObject: { name },
        })),
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
    const finalConfig = s.build(myConfig, { noFailOnError: true }).config;
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
    const s = createTypedServerless<unknown, ValidIds, ResourceParamsWithTags>({
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
        ...s.resource('secret-id-1', ({ name, tags }) => ({
          myCustomObject: { name, tags },
        })),
        ...s.resource('queue-id-2', ({ name, tags }) => ({
          myCustomObject: { name, tags },
        })),
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
    const finalConfig = s.build(myConfig, { noFailOnError: true }).config;
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
    const s = createTypedServerless(defaultParams);
    const myConfig = {
      myResources: {
        ...s.resource(
          'my-queue',
          ({ name }) =>
            new SQS.Queue({
              QueueName: name,
            })
        ),
        ...s.resource(
          'my-bucket',
          () =>
            new S3.Bucket({
              BucketName: 'my-bucket-fixed-name',
            })
        ),
      },
    };
    // When
    const finalConfig = JSON.parse(JSON.stringify(s.build(myConfig).config));
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
});
