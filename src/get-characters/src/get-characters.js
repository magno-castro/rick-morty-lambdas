import axios from "axios";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const API_URL = "https://rickandmortyapi.com/api";
const TABLE_NAME = "rick-morty-table";
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

const getCharacterFromDB = async (id) => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: parseInt(id) },
  });

  const response = await docClient.send(command);
  return response.Item;
};

const getAllEditedCharacters = async () => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "#source = :sourceValue",
    ExpressionAttributeNames: {
      "#source": "source",
    },
    ExpressionAttributeValues: {
      ":sourceValue": "canonical",
    },
  });

  const response = await docClient.send(command);
  return response.Items || [];
};

const getAllNewCharacters = async () => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "#source = :sourceValue",
    ExpressionAttributeNames: {
      "#source": "source",
    },
    ExpressionAttributeValues: {
      ":sourceValue": "filler",
    },
  });

  const response = await docClient.send(command);
  return response.Items || [];
};

const mergeCharacters = async (apiCharacters, customCharacters) => {
  const customMap = new Map(customCharacters.map((char) => [char.id, char]));

  const characters = apiCharacters.map((char) => {
    const customChar = customMap.get(char.id);
    if (customChar) return customChar;
    return char;
  });

  return await invokeSanitizer(characters);
};

export const handler = async (event) => {
  try {
    const characterId = event.pathParameters?.id;
    const page = event.queryStringParameters?.page || "1";

    if (characterId) {
      const customCharacter = await getCharacterFromDB(characterId);

      if (customCharacter) {
        return {
          statusCode: 200,
          body: JSON.stringify(customCharacter),
        };
      }

      const response = await axios.get(`${API_URL}/character/${characterId}`);
      const sanitizedCharacter = await invokeSanitizer(response.data);

      return {
        statusCode: 200,
        body: JSON.stringify(sanitizedCharacter),
      };
    }

    const [apiResponse, editedCharacters] = await Promise.all([
      axios.get(`${API_URL}/character?page=${page}`),
      getAllEditedCharacters(),
    ]);

    let results = await mergeCharacters(
      apiResponse.data.results.map((char) => ({
        ...char,
        source: "canonical",
      })),
      editedCharacters
    );

    if (page === "1") {
      results = [...(await getAllNewCharacters()), ...results];
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        results: results,
      }),
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        message: error.message,
      }),
    };
  }
};
