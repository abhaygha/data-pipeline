import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class DataProcessingPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table with encryption
    const table = new dynamodb.Table(this, 'ProcessedDataTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Lambda function
    const processingFunction = new lambda.Function(this, 'ProcessingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda function read/write permissions to DynamoDB table
    table.grantReadWriteData(processingFunction);

    // More granular IAM policy
    const dynamoDbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
      ],
      resources: [table.tableArn],
    });

    processingFunction.addToRolePolicy(dynamoDbPolicy);

    // API Gateway with API Key authentication
    const api = new apigateway.RestApi(this, 'DataProcessingApi', {
      restApiName: 'Data Processing Service',
      description: 'This service processes uploaded text files.',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const plan = api.addUsagePlan('UsagePlan', {
      name: 'Standard',
      throttle: {
        rateLimit: 10,
        burstLimit: 2,
      },
    });

    const apiKey = api.addApiKey('ApiKey');
    plan.addApiKey(apiKey);

    const uploadIntegration = new apigateway.LambdaIntegration(processingFunction);
    const uploadMethod = api.root.addMethod('POST', uploadIntegration, {
      apiKeyRequired: true,
    });

    plan.addApiStage({
      stage: api.deploymentStage,
      throttle: [
        {
          method: uploadMethod,
          throttle: {
            rateLimit: 10,
            burstLimit: 2,
          },
        },
      ],
    });

    // Output the API URL and API Key
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'ApiKey', {
      value: apiKey.keyId,
      description: 'API Key ID (retrieve value from AWS Console or CLI)',
    });
  }
}