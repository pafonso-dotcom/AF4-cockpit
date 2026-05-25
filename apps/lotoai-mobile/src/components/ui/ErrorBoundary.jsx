import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[LOTOAI]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="card max-w-md">
            <h1 className="text-gold text-xl font-bold mb-2">Algo deu errado</h1>
            <p className="text-white/70 text-sm mb-4">{String(this.state.error?.message || this.state.error)}</p>
            <button className="btn-primary w-full" onClick={() => location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
