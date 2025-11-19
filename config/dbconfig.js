var config = {
  development: {
    //url to be used in link generation
    url: "http://localhost:3000",

    //mongodb connection settings
    database: {
      host: "127.0.0.1",
      port: "27017",
      db: "packmates",
      params: "",
    },

    //server details
    server: {
      host: "127.0.0.1",
      port: "3000",
    },

    secret: "PACKMATES_AUTHENTICATION_SECRET_KEY",
  },
  production: {
    //url to be used in link generation image upload
    url: "",

    //mongodb connection settings
    database: {
      host: "127.0.0.1",
      port: "27017",
      db: "packmates",
      params: "",
    },

    //server details
    server: {
      host: "127.0.0.1",
      port: "3000",
    },

    secret: "PACKMATES_AUTHENTICATION_SECRET_KEY",
  },
};

module.exports = config;

