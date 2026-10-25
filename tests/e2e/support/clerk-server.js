// E2E ONLY (aliased in when E2E=1, see next.config.js) — signed-in Clerk server stub.
module.exports = {
  auth: async () => ({ userId: "user_e2e" }),
  currentUser: async () => ({ id: "user_e2e", firstName: "Sujal", lastName: "Tyagi", imageUrl: "", emailAddresses: [{ emailAddress: "test.user@example.com" }] }),
  clerkMiddleware: () => () => undefined,
  createRouteMatcher: () => () => true,
};
