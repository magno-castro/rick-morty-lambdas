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

const getAllEditedCharacters = async (nameFilter) => {
  const sourceFilterExpression = "#source = :sourceValue";
  const nameFilterExpression = nameFilter
    ? " AND contains(#name, :nameValue)"
    : "";

  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: sourceFilterExpression + nameFilterExpression,
    ExpressionAttributeNames: {
      "#source": "source",
      ...(nameFilter && { "#name": "name" }),
    },
    ExpressionAttributeValues: {
      ":sourceValue": "canonical",
      ...(nameFilter && { ":nameValue": nameFilter }),
    },
  });

  const response = await docClient.send(command);
  return response.Items || [];
};

const getAllNewCharacters = async (nameFilter) => {
  const sourceFilterExpression = "#source = :sourceValue";
  const deletedFilterExpression =
    " AND (attribute_not_exists(deleted_at) OR deleted_at = :emptyValue)";
  const nameFilterExpression = nameFilter
    ? " AND contains(#name, :nameValue)"
    : "";

  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression:
      sourceFilterExpression + deletedFilterExpression + nameFilterExpression,
    ExpressionAttributeNames: {
      "#source": "source",
      ...(nameFilter && { "#name": "name" }),
    },
    ExpressionAttributeValues: {
      ":sourceValue": "filler",
      ":emptyValue": "",
      ...(nameFilter && { ":nameValue": nameFilter }),
    },
  });

  const response = await docClient.send(command);
  return response.Items || [];
};

const mergeCharacters = async (apiCharacters, dbCharacters) => {
  const customMap = new Map(dbCharacters.map((char) => [char.id, char]));

  const characters = apiCharacters
    .map((char) => {
      const dbChar = customMap.get(char.id);
      if (dbChar) return dbChar;
      return char;
    })
    .filter((char) => !char.deleted_at);

  return await invokeSanitizer(characters);
};

const addSource = (char) => ({
  ...char,
  source: "canonical",
});

export const handler = async (event) => {
  try {
    const characterId = event.pathParameters?.id;
    const name = event.queryStringParameters?.name;
    const page = event.queryStringParameters?.page || "1";

    if (characterId) {
      const customCharacter = await getCharacterFromDB(characterId);

      if (customCharacter) {
        if (customCharacter.deleted_at) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              message: "Character not found",
            }),
          };
        } else {
          return {
            statusCode: 200,
            body: JSON.stringify(customCharacter),
          };
        }
      }

      const response = await axios.get(`${API_URL}/character/${characterId}`);
      const sanitizedCharacter = await invokeSanitizer(
        addSource(response.data)
      );

      return {
        statusCode: 200,
        body: JSON.stringify(sanitizedCharacter),
      };
    }

    let apiResults = [];

    // Check if the API response is empty and handle it
    try {
      const apiUrl = name
        ? `${API_URL}/character?page=${page}&name=${name}`
        : `${API_URL}/character?page=${page}`;

      const apiResponse = await axios.get(apiUrl);
      apiResults = apiResponse.data.results;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    const editedCharacters = await getAllEditedCharacters(name);

    let results =
      apiResults.length === 0
        ? editedCharacters
        : await mergeCharacters(apiResults.map(addSource), editedCharacters);

    if (page === "1") {
      results = [...(await getAllNewCharacters(name)), ...results];
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
