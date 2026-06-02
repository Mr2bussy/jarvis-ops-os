import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#030509',fontFamily:'JetBrains Mono, monospace',gap:12}}>
          <span style={{fontSize:10,color:'#ff1a6b',letterSpacing:'0.22em'}}>JARVIS CRITICAL ERROR</span>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.5)',maxWidth:600,textAlign:'center'}}>{this.state.error.message}</span>
          <button onClick={()=>this.setState({error:null})} style={{marginTop:8,padding:'5px 18px',fontSize:8,cursor:'pointer',border:'1px solid #ff1a6b44',background:'rgba(255,26,107,0.08)',color:'#ff1a6b',letterSpacing:'0.18em'}}>RECOVER</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
