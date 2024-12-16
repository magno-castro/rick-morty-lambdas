import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import axios from "axios";

const TABLE_NAME = "rick-morty-table";
const API_URL = "https://rickandmortyapi.com/api";
const SANITIZER_FUNCTION = "rick-morty-sanitizer";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient({});

const invokeSanitizer = async (character) => {
  const command = new InvokeCommand({
    FunctionName: SANITIZER_FUNCTION,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify(character),
  });

  const response = await lambdaClient.send(command);
  const payload = JSON.parse(Buffer.from(response.Payload).toString());
  return payload.body;
};

export const handler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        body: {
          message: "Character ID is required",
        },
      };
    }

    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: Number(id) },
    });

    const { Item: existingCharacter } = await docClient.send(getCommand);

    if (existingCharacter?.deleted_at) {
      return {
        statusCode: 400,
        body: {
          message: "Character is already deleted",
          deleted_at: existingCharacter.deleted_at,
        },
      };
    }

    let characterToUpdate;

    if (existingCharacter) {
      characterToUpdate = existingCharacter;
    } else {
      try {
        const response = await axios.get(`${API_URL}/character/${id}`);
        const apiCharacter = response.data;

        characterToUpdate = await invokeSanitizer({
          ...apiCharacter,
          source: "canonical",
        });
      } catch (apiError) {
        if (apiError.response?.status === 404) {
          return {
            statusCode: 404,
            body: {
              message: "Character not found",
            },
          };
        }
        throw apiError;
      }
    }

    const deleted_at = new Date().toISOString();
    characterToUpdate = {
      ...characterToUpdate,
      deleted_at,
    };

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: characterToUpdate,
    });

    await docClient.send(putCommand);

    return {
      statusCode: 200,
      body: characterToUpdate,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        message: error.message,
      },
    };
  }
};
