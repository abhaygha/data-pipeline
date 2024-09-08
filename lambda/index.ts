import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'No file content provided' }),
    };
  }

  try {
    const fileContent = Buffer.from(event.body, 'base64').toString('utf-8');
    const processedData = processTextFile(fileContent);

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        id: Date.now().toString(),
        content: processedData,
      },
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'File processed and stored successfully' }),
    };
  } catch (error) {
    console.error('Error processing file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing file' }),
    };
  }
};

function processTextFile(content: string): string {
  // Implement your text processing logic here
  // For this example, we'll just return the uppercase version of the content
  return content.toUpperCase();
}