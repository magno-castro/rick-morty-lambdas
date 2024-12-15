import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "rick-morty-table";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

export const handler = async (event) => {
  try {
    const character = event;
    
    const requiredFields = ['name', 'status', 'species', 'gender', 'origin', 'location', 'image'];
    const missingFields = requiredFields.filter(field => !character[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: {
          message: `Missing required fields: ${missingFields.join(', ')}`
        }
      };
    }

    const timestamp = Date.now();
    const randomNumber = Math.floor(Math.random() * 1000); 
    character.id = Number(`${timestamp}${randomNumber}`);
    character.source = "filler";

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: character
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      body: character
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        message: error.message
      }
    };
  }
};
