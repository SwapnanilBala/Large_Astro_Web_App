import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

// Suppress console.error from error boundaries during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Annotated `never` on purpose: a function declaration whose body only throws is
// inferred as returning `void`, which is not a valid JSX element type. The
// annotation states what the component already does.
function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message);
}

function SafeComponent() {
  return <div data-testid="safe">All good</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("safe")).toBeInTheDocument();
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders default error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test explosion" />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
  });

  it("renders custom fallback ReactNode", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom">Custom error</div>}>
        <ThrowingComponent message="boom" />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders custom fallback function with error and reset", () => {
    const fallbackFn = vi.fn((error: Error, reset: () => void) => (
      <div>
        <span data-testid="error-msg">{error.message}</span>
        <button onClick={reset}>Reset</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={fallbackFn}>
        <ThrowingComponent message="custom error" />
      </ErrorBoundary>
    );

    expect(fallbackFn).toHaveBeenCalled();
    expect(screen.getByTestId("error-msg")).toHaveTextContent("custom error");
  });

  it("resets error state when retry button is clicked", () => {
    // We use a counter to make the component succeed on the second render
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) {
        throw new Error("First render fail");
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the "error" so next render succeeds
    shouldThrow = false;

    // Click retry
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    expect(screen.getByTestId("recovered")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("logs error and component stack to console", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="logged error" />
      </ErrorBoundary>
    );

    expect(errorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary] Caught error:",
      expect.any(Error)
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary] Component stack:",
      expect.any(String)
    );
  });
});
