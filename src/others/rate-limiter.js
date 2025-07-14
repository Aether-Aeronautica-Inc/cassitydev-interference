// src/rate-limiter.js
const limits = {};

export default {
  allow(agent) {
    const now = Date.now();
    if (!limits[agent] || now - limits[agent] > 3000) {
      return true;
    }
    return false;
  },
  tick(agent) {
    limits[agent] = Date.now();
  }
};
