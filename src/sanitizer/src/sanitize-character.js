const sanitizeCharacter = (character) => {
  const { id, name, status, species, type, gender, origin, location, image } =
    character;

  return {
    id,
    name,
    status,
    species,
    type,
    gender,
    origin: origin.name,
    location: location.name,
    image,
  };
};

export const handler = async (event) => {
  try {
    let sanitizedResult;

    if (Array.isArray(event)) {
      sanitizedResult = event.map((character) => sanitizeCharacter(character));
    } else {
      sanitizedResult = sanitizeCharacter(event);
    }

    return {
      statusCode: 200,
      body: sanitizedResult,
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
