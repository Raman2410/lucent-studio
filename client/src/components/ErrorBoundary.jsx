import { Component } from "react";

/**
 * ErrorBoundary — catches render-time crashes anywhere in the tree
 * below it and shows a real message instead of a blank white page.
 *
 * Why this matters: React unmounts the ENTIRE tree when a component
 * throws during render and nothing catches it — that's the "page
 * goes completely blank" symptom. Wrapping the app here means any
 * future bug shows an actual error (and in dev, the message + stack)
 * instead of silence.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // still log to console so it shows up in DevTools as before
    console.error("Uncaught render error:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6">
        <div className="max-w-md text-center">
          <p className="meta-caption mb-2">Something went wrong</p>
          <h1 className="font-display text-2xl text-ink mb-4">This page hit an error</h1>
          <p className="text-mist text-[14px] leading-relaxed mb-6">
            Sorry about that — please try going back to the home page.
          </p>

          {import.meta.env.DEV && (
            <pre className="text-left text-[11px] text-red-600 bg-red-50 border border-red-200 p-3 mb-6 overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-ink text-paper text-sm font-medium rounded-full hover:bg-signature transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }
}
