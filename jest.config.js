// eslint-disable-next-line no-undef
module.exports = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  roots: ["<rootDir>/src/", "<rootDir>/tests/"]
};
