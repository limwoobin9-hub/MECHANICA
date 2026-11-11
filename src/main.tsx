import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{
  state={error:false};
  static getDerivedStateFromError(){return{error:true};}
  render(){return this.state.error?<div className="fatal-error"><h1>MECHANICA</h1><p>화면을 표시하지 못했습니다. 저장된 프로젝트는 브라우저에 보관되어 있습니다.</p><button onClick={()=>location.reload()}>다시 열기</button></div>:this.props.children;}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
