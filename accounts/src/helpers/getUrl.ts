const getUrl = (): string => {
    return process.env.NODE_ENV === "production"
      ? "https://eventis-api.herokuapp.com/"
      : "http://localhost:4000/";
};

export default getUrl