"use client";
// E2E ONLY (aliased in when E2E=1, see next.config.js) — signed-in Clerk client stub.
const React = require("react");
const user = { firstName: "Sujal", lastName: "Tyagi", fullName: "Sujal Tyagi", imageUrl: "", primaryEmailAddress: { emailAddress: "test.user@example.com" }, emailAddresses: [{ emailAddress: "test.user@example.com" }] };
const box = (label) => () => React.createElement("div", { style: { width: 380, maxWidth: "100%", height: 460, border: "1px solid #333", borderRadius: 16, color: "#888", display: "flex", alignItems: "center", justifyContent: "center" } }, label);
module.exports = {
  ClerkProvider: ({ children }) => children,
  SignIn: box("Clerk SignIn (E2E stub)"),
  SignUp: box("Clerk SignUp (E2E stub)"),
  useAuth: () => ({ isSignedIn: true, isLoaded: true, userId: "user_e2e" }),
  useUser: () => ({ user, isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ user, signOut: () => {} }),
  UserButton: () => null,
};
