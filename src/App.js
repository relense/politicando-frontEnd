import React, { Component } from 'react';
import './App.css';
import Header from './components/header/Header.js';
import MainContent from './components/mainContent/MainContent.js';


const dimensions = { height: window.innerHeight, width: window.innerWidth };

class App extends Component {
  render() {
    return (
      <div className="parentContainer" style={dimensions}>
        <Header />
        <MainContent />
      </div>
    );
  }
}

export default App;
