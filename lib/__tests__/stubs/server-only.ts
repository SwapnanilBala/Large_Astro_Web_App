/**
 * Stand-in for the `server-only` package under vitest.
 *
 * The real package ships a module that throws if it is ever bundled for the
 * client; Next enforces that at compile time. There is nothing to import at
 * runtime, so a test that pulls in a server-only module fails to collect
 * without this. Empty on purpose.
 */
export {};
