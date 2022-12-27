const getUrl = (): string => {
    return process.env.NODE_ENV === "production"
      ? "https://retropay.app/"
      : "http://localhost:4000/";
};

export default getUrl