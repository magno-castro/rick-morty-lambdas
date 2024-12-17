## Rick & Morty Character Management API

**A serverless application built with AWS Lambda that manages Rick & Morty characters, integrating with the official Rick & Morty API while allowing custom character creation and modifications.**

## Overview

This application provides a set of serverless APIs to:

- Fetch characters from the Rick & Morty universe
- Create custom characters
- Modify existing characters
- Delete characters
- Search characters by name

## Architecture

The application uses:

- **AWS Lambda** for serverless compute
- **DynamoDB** for data persistence
- **API Gateway** for RESTful endpoints
- **AWS SDK v3** for AWS service interactions

## Lambda Functions

### get-characters

- Fetches characters from both the Rick & Morty API and DynamoDB
- Supports pagination and name filtering
- Merges results from both sources
- Endpoint: GET /characters
- Query Parameters:
  - page (optional): Page number for pagination
  - name (optional): Filter characters by name

### create-character

- Creates new custom characters
- Validates required fields
- Generates unique IDs
- Endpoint: POST /characters
- Required fields:
  - name
  - status
  - species
  - gender
  - origin
  - location

### update-character

- Updates existing characters
- Validates required fields
- Endpoint: PUT /characters/{id}
- Required fields:
  - id
  - name
  - status
  - species
  - gender
  - origin
  - location

### delete-character

- Deletes characters by ID
- Endpoint: DELETE /characters/{id}
- Query Parameters:
  - id (required): ID of character to delete

## API Documentation

**GET /characters**

```json
[
  {
    "id": 1,
    "name": "Rick Sanchez",
    "status": "Alive",
    "species": "Human",
    "gender": "Male",
    "origin": "Earth",
    "location": "Earth",
    "source": "canonical"
  }
]
```

**POST /characters**

```json
{
  "name": "Custom Rick",
  "status": "Alive",
  "species": "Human",
  "gender": "Male",
  "origin": "Earth C-137",
  "location": "Citadel of Ricks"
}
```

## Environment Variables

- **TABLE_NAME:** DynamoDB table name
- **API_URL:** Rick & Morty API base URL
- **SANITIZER_FUNCTION:** (Optional) Lambda function name for character sanitization

## Notes

- The application uses a merge strategy to combine results from the external API and custom characters.
- Character IDs are generated using timestamp and random number combination.
- Deleted characters are soft-deleted using a deleted_at timestamp.
