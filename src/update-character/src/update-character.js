import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "rick-morty-table";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const getCharacterFromDB = async (id) => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: parseInt(id) },
  });

  const response = await docClient.send(command);
  return response.Item;
};

export const handler = async (event) => {
  try {
    const characterId = event.pathParameters?.id;
    const updates = JSON.parse(Buffer.from(event.body).toString());;

    if (!characterId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Character ID is required" })
      };
    }

    const existingCharacter = await getCharacterFromDB(characterId);
    
    const characterToUpdate = {
      id: parseInt(characterId),
      ...(existingCharacter || {}),
      ...updates
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: characterToUpdate
    });

    await docClient.send(command);

    return {
      statusCode: existingCharacter ? 200 : 201,
      body: JSON.stringify(characterToUpdate)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message
      })
    };
  }
};
