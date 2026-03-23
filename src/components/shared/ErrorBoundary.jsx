import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("LoveBridge error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-petal flex items-center justify-center p-4">
          <div className="bg-white/70 backdrop-blur-xl rounded-4xl shadow-soft border border-white/80 p-10 max-w-md w-full text-center space-y-6">
            <div className="text-5xl">💔</div>
            <h1 className="font-serif text-3xl text-softdark">Something went wrong</h1>
            <p className="text-sm text-softdark/50">
              Don't worry — your data is safe. Try refreshing the page.
            </p>
            <p className="text-xs text-softdark/30 bg-rose/10 rounded-2xl p-3 font-mono text-left">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-plum to-plum-light text-white text-sm font-medium shadow-plum hover:-translate-y-0.5 transition-all">
              Refresh Page ↺
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full py-2 rounded-2xl text-plum/50 hover:text-plum text-sm transition-colors">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}