<div id="top"></div>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<br />
<div align="center">
  <h3 align="center">Typed Serverless</h3>

  <p align="center">
    Fully typed and consistent Serverless Framework configurations, 100% TypeScript, for a world without YAML.
    <br />
    <a href="https://github.com/gabrielmoreira/typed-serverless#quick-start"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/gabrielmoreira/typed-serverless/tree/main/examples/">View examples</a>
    ·
    <a href="https://github.com/gabrielmoreira/typed-serverless/issues">Report Bug</a>
    ·
    <a href="https://github.com/gabrielmoreira/typed-serverless/issues">Request Feature</a>
  </p>
</div>

## Contents

- [Why?](#why)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Examples](https://github.com/gabrielmoreira/typed-serverless/tree/main/examples)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [Acknowledgments](#acknowledgments)

## <a name="why"></a> Why?

**TL;DR** YAML should not exist. https://noyaml.com/

**Typed Serverless** helps you build a Serverless application using only TypeScript & Serverless Framework. It's a small library to help you build strongly typed `serverless.ts`, including AWS CloudFormation resources, logical ids and references between resources, all typed and with an excellent autocomplete.

Serverless Framework is a great framework to create serverless applications, but usually you will see YAML configurations instead of TypeScript. Usually it starts with a very simple `serverless.yaml` configuration, but as more features are added, it becomes tricky to ensure that everthing is correctly configured and consistent. In some cases YAML is not enough, and we need some serverless plugin to rescue us.

### Some reasons:
* Save time. Many errors that would only happen at runtime can be prevented by using TypeScript. For example, a very common mistake is referencing a wrong ARN resource when defining an IAM Policy.

* Autocomplete for almost everything, including all IDs you define for your resources, and also all AWS CloudFormation resources using [Typed AWS](https://github.com/gabrielmoreira/typed-aws).

* Ensure a consistent style. Avoid hundreds of string interpolations and copy-and-paste by creating helper functions.

* It reduces the need for some Serverless plugins for simple tasks like conditionals, resource tags, environment validation, and anything else that can be replaced by an imperative programming language.

<p align="right">(<a href="#top">back to top</a>)</p>

## <a name="quick-start"></a> Quick Start

### Install Via NPM:
  ```bash
  npm install --save-dev typed-serverless typed-aws serverless ts-node serverless-esbuild
  ```

### Create a Serverless configuration

Create a `serverless.ts`:
  ```ts
  import type { AWS } from '@serverless/typescript';
  import { TypedServerless, SQS } from 'typed-serverless';

  type Ids = 'MyQueue' | 'SendMessageFn';

  const typed = TypedServerless.createDefault<Ids>();

  const serverlessConfiguration: AWS = {
    service: 'minimal',
    plugins: ['serverless-esbuild'],
    provider: {
      name: 'aws',
      runtime: 'nodejs14.x',
      region: 'eu-west-1',
      lambdaHashingVersion: '20201221',
      tags: {
        myCustomTag: 'my-sample-tag',
      },
      iam: {
        role: {
          statements: [
            {
              Effect: 'Allow',
              Action: 'sqs:*',
              Resource: typed.getArn('MyQueue'),
            },
          ],
        },
      },
    },
    resources: {
      Resources: {
        ...typed.resources({
          'MyQueue': ({ name, awsTags }) =>
            SQS.Queue({ QueueName: name, Tags: awsTags}),
        }),
      },
    },
    functions: typed.functions({
      'SendMessageFn': ({ name }) => ({
        name,
        handler: './mylambda.handler',
        events: [{ http: { method: 'get', path: 'send' } }],
        environment: {
          QUEUE_URL: typed.ref('MyQueue'),
        },
      }),
    }),
  };

  module.exports = typed.build(serverlessConfiguration);
  ```
### Create your Lambda

Create your first lambda file `mylambda.handler`:

```ts
import { SQS } from 'aws-sdk';

const sqs = new SQS();

export const handler = async (event) => {
  const messageSent = await sqs
    .sendMessage({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify({
        createdAt: new Date().toISOString(),
        event,
      }),
    })
    .promise();
  return { statusCode: 200, body: JSON.stringify({ messageSent })};
};
```

### Deploy it!

```bash
npx sls --stage dev deploy
```

## Usage

### <a name="api-resources"></a> `resources({ '<ResourceId>': ResourceBuilder })`
Used to define your resources.

- `ResourceId` should be a valid string literal type defined at `Ids` in `TypedServerless.createDefault<Ids>()`
- `ResourceBuilder` should be a function like `(resourceParams) => SomeResouceObject()`. 
  
  This function will be called with `resourceParams`. If your are using `TypeServerless.createDefault<>()`, it means that your `resourceParams` will be `{ name, tags, awsTags }`
  - `name` will be `'{service}-{stage}-{ResourceId}'`
  - `tags` will be the same value you define at your serverlessConfig.provider.tags.
  - `awsTags` will be your serverlessConfig.provider.tags converted to an array of `{ Key: string, Value: string }`

**Important**: Always use `name` in your resource, so this way, Typed Serverless can keep track of any logical id to name mapping. It's important for other features like `.getName('ResourceId')`.

Tip: We are using `typed-aws` to provide almost all CloudFormation Resource. Please check if your [resource is available](https://github.com/gabrielmoreira/typed-aws/tree/main/types/resources).

Tip: You can also create your own `resourceParams` by providing a custom `resourceParamsFactory` through `TypedServerless.create<Ids>({ resourceParamsFactory })`. See our default implementation at `https://github.com/gabrielmoreira/typed-serverless/tree/main/src/aws/defaults.ts` 

E.g.
```ts
type Ids = 'MyQueue' | 'SomeOtherResource';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  Resources: typed.resources({ 
    'MyQueue': ({ name }) =>
      SQS.Queue({ QueueName: name }), // Always use the provided name

    'SomeOtherResource': ...
  })
  ...
}
```

### <a name="api-ref"></a> `ref('<ResourceId>')` or `getRef('<ResourceId>')`

Use this function to make a CloudFormation reference to a resource. E.g. `{'Ref': 'SomeResourceId'}`.

- `ResourceId` should be a valid string literal type defined at `Ids` in `TypedServerless.createDefault<Ids>()`

**Important**: Every CloudFormation resource has a differente return value for a `Ref` property. E.g. SQS Queues `Ref` property [returns the queue URL](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-sqs-queues.html#aws-properties-sqs-queues-return-values).

Note: This function will also validate if you are referencing a defined resource using `resources({ ... })`

```ts
type Ids = 'MyQueue' | 'MyDeadLetterQueue';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  resources: {
    Resources: typed.resources({ 
      'MyQueue': ({ name }) =>
        SQS.Queue({ QueueName: name }),
    }),
  },
  functions: typed.functions({
    'SendMessageFn': ({ name }) => ({
      name,
      handler: './mylambda.handler',
      events: [{ http: { method: 'get', path: 'send' } }],
      environment: {
        QUEUE_URL: typed.ref('MyQueue'),
      },
    }),
  }),
  ...
}
```

### <a name="api-arn"></a> `arn('<ResourceId>')` or `getArn('<ResourceId>')`

Use this function to make a CloudFormation reference to a resource `ARN`. E.g. `{'Fn::GetAtt': ['SomeResourceId', 'Arn']}`.

- `ResourceId` should be a valid string literal type defined at `Ids` in `TypedServerless.createDefault<Ids>()`

Note: This function will also validate if you are referencing a defined resource using `resources({ ... })`

```ts
type Ids = 'MyQueue' | 'MyDeadLetterQueue';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  Resources: typed.resources({ 
    'MyQueue': ({ name }) =>
      SQS.Queue({
        QueueName: name,
        RedrivePolicy: {
          deadLetterTargetArn: typed.arn('MyDeadLetterQueue'),
          maxReceiveCount: 3,
        },
      }),

    'MyDeadLetterQueue': ({ name }) =>
      SQS.Queue({ QueueName: name }),
  })
  ...
}
```

### <a name="api-getName"></a> `getName('<ResourceId>')`

Use this function to get a resource name.

- `ResourceId` should be a valid string literal type defined at `Ids` in `TypedServerless.createDefault<Ids>()`

Important: 

Note: This function will also validate if you are referencing a defined resource using `resources({ ... })`

```ts
type Ids = 'MyQueue' | 'MyDeadLetterQueue';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  Resources: typed.resources({ 
    'MyQueue': ({ name }) =>
      SQS.Queue({
        QueueName: name,
        RedrivePolicy: {
          deadLetterTargetArn: typed.arn('MyDeadLetterQueue'),
          maxReceiveCount: 3,
        },
      }),

    'MyDeadLetterQueue': ({ name }) =>
      SQS.Queue({ QueueName: name }),
  })
  ...
}
```

### <a name="api-stringify"></a> `stringify( anyObject )`

Use this function to be able to serialize an object to a JSON string when you also want to support CloudFormation expressions evaluation inside the object.

The main use case for this is to overcome a limitation in CloudFormation that does not allow using CloudFormation intrinsic functions (like Fn::Get, Ref, Fn::*) in a JSON string. This is common when creating a AWS CloudWatch Dashboard, a Step Function State Machine, and other places.

- `anyObject` should be any valid TypeScript object.

```ts
type Ids = 'MyQueue' | 'MyDeadLetterQueue';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  resources: {
    Resources: typed.resources({ 
      'MyQueue': ({ name }) =>
        SQS.Queue({ QueueName: name }),
    }),
  },
  functions: typed.functions({
    'SendMessageFn': ({ name }) => ({
      name,
      handler: './mylambda.handler',
      events: [{ http: { method: 'get', path: 'send' } }],
      environment: {
        COMPLEX_JSON_STRING: typed.stringify({ 
          // typed.stringify will preserve all CloudFormation expressions (.ref, .arn, .getName) below:
          queueUrl: typed.ref('MyQueue'),
          queueArn: typed.arn('MyQueue'),
          queueName: typed.getName('MyQueue'),
        })
      },
    }),
  }),
  ...
}
```

### <a name="api-buildLambdaArn"></a> `buildLambdaArn('<ResourceId>')`

Use this function to be able to make a soft reference to a lambda. It means that instead of creating a CloudFormation reference like `.arn('<ResourceId>')`, we build an ARN string for your resource, be we also validate if this resource was previously defined using `.resources({'<ResourceId>': <ResourceBuilder> })`

The main use case for this is to overcome a limitation in CloudFormation that does not allow a circular reference. It's very common issue when you have a lambda that references an IAM policy that references to the same lambda, creating a circular dependency.

- `ResourceId` should be a valid string literal type defined at `Ids` in `TypedServerless.createDefault<Ids>()`

```ts
type Ids = 'MyQueue' | 'MyDeadLetterQueue';
const typed = TypedServerless.createDefault<Ids>();

const serverlessConfiguration: AWS = {
  ...
  resources: {
    Resources: typed.resources({ 
      'MyQueue': ({ name }) =>
        SQS.Queue({ QueueName: name }),
    }),
  },
  functions: typed.functions({
    'SendMessageFn': ({ name }) => ({
      name,
      handler: './mylambda.handler',
      events: [{ http: { method: 'get', path: 'send' } }],
      environment: {
        COMPLEX_JSON_STRING: typed.stringify({ 
          // typed.stringify will preserve all CloudFormation expressions (.ref, .arn, .getName) below:
          queueUrl: typed.ref('MyQueue'),
          queueArn: typed.arn('MyQueue'),
          queueName: typed.getName('MyQueue'),
        })
      },
    }),
  }),
  ...
}
```

### <a name="api-create"></a> `TypedServerless.create(param)`

TODO Document
```
  resourceParamsFactory: (id: TId, config: TConfigType) => TResourceParams;
  onResourceCreated?: (resource: Resource<CfnResourceProps>) => void;
  onFunctionCreated?: (lambda: ServerlessFunction) => void;
```
TODO Document

### <a name="api-extendWith"></a> `extendWith((typed) => extension)`

TODO Document

### <a name="api-only"></a> `only<OtherIds>(object)`

TODO Document


## Examples

Check out [our examples](https://github.com/gabrielmoreira/typed-serverless/tree/main/examples/).

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* Inspired by [cloudform](https://github.com/bright/cloudform)
* [Serverless Framework](https://github.com/serverless/serverless)
* [Serverless Typescript Types](https://github.com/serverless/typescript)

<p align="right">(<a href="#top">back to top</a>)</p>


<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/gabrielmoreira/typed-serverless.svg?style=for-the-badge
[contributors-url]: https://github.com/gabrielmoreira/typed-serverless/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/gabrielmoreira/typed-serverless.svg?style=for-the-badge
[forks-url]: https://github.com/gabrielmoreira/typed-serverless/network/members
[stars-shield]: https://img.shields.io/github/stars/gabrielmoreira/typed-serverless.svg?style=for-the-badge
[stars-url]: https://github.com/gabrielmoreira/typed-serverless/stargazers
[issues-shield]: https://img.shields.io/github/issues/gabrielmoreira/typed-serverless.svg?style=for-the-badge
[issues-url]: https://github.com/gabrielmoreira/typed-serverless/issues
[license-shield]: https://img.shields.io/github/license/gabrielmoreira/typed-serverless.svg?style=for-the-badge
[license-url]: https://github.com/gabrielmoreira/typed-serverless/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/gabriel-moreira
