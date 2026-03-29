// Enable React's act() environment for testing.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// The hooks re-throw errors inside startTransition's .catch() handler, both
// navigation errors (for Next.js error boundaries) and regular errors (for
// React error boundaries). In the browser, React catches these at the framework
// level. In tests, they surface as unhandled rejections. Suppress them here
// since the hook state (thrownError / navigationError) is what we assert on.
process.on("unhandledRejection", () => {});
